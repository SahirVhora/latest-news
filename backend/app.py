#!/usr/bin/env python3
"""
LatestNews — Flask API backend
Sources: Reddit · Hacker News · Dev.to · GitHub · DuckDuckGo
All fetched in parallel, relevance-filtered, sorted newest-first.

Usage:
    pip install flask flask-cors
    python app.py
"""

import datetime
import html as html_lib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# --- CACHE SYSTEM ---
# Simple in-memory cache: { "query_mode_sources": (timestamp, data) }
SEARCH_CACHE = {}
CACHE_TTL = 900  # 15 minutes in seconds

# ── App setup ─────────────────────────────────────────────────────────────────
DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app = Flask(__name__, static_folder=DIST_DIR, static_url_path="/")
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://sahirvhora.github.io"
CORS(app, origins=os.environ.get("ALLOWED_ORIGINS", _default_origins).split(","))

_scrape_semaphore = threading.Semaphore(5)

DAYS_30 = 30 * 24 * 3600

# Realistic browser UA — some sources block obvious bot strings
BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
BASE_HEADERS = {"User-Agent": BROWSER_UA, "Accept": "application/json"}


# ── Utilities ─────────────────────────────────────────────────────────────────
def _now() -> int:
    return int(time.time())


def fetch_json(url: str, extra_headers: dict | None = None, timeout: int = 14) -> dict | list | None:
    headers = {**BASE_HEADERS, **(extra_headers or {})}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))
    except Exception:
        return None


def fetch_html(url: str, timeout: int = 14) -> str:
    headers = {**BASE_HEADERS, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""


def fmt_date(ts: int) -> str:
    return datetime.datetime.fromtimestamp(ts, datetime.UTC).strftime("%d %b %Y")


def recency(ts: int, now: int) -> float:
    return max(0.0, 1.0 - (now - ts) / DAYS_30)


def engagement_score(upvotes: int, comments: int, ts: int, now: int) -> float:
    return round((upvotes + comments * 2) * (0.4 + 0.6 * recency(ts, now)), 1)


# ── Relevance filtering ───────────────────────────────────────────────────────
def _query_terms(query: str) -> list[str]:
    """Return significant words from the query (len >= 3, lowercased)."""
    return [w.lower() for w in re.split(r"\W+", query) if len(w) >= 3]


def relevance_score(title: str, snippet: str, query: str) -> float:
    """
    Fraction of query terms that appear in title+snippet.
    Returns 1.0 when query has no significant terms (passthrough).
    Title matches are weighted 2x snippet matches.
    """
    terms = _query_terms(query)
    if not terms:
        return 1.0
    title_l = title.lower()
    snippet_l = snippet.lower()
    score = sum(
        (2 if t in title_l else 1) if (t in title_l or t in snippet_l) else 0
        for t in terms
    )
    max_score = len(terms) * 2  # all terms match title
    return score / max_score


def is_relevant(title: str, snippet: str, query: str, threshold: float = 0.25) -> bool:
    """
    At least `threshold` fraction of relevance must be met.
    Threshold 0.25 means: for a 2-word query, at least one word must appear
    somewhere in the title or snippet.
    """
    return relevance_score(title, snippet, query) >= threshold


# ── DDG URL decoder ───────────────────────────────────────────────────────────
def _strip(text: str) -> str:
    """Strip HTML tags then decode entities like &quot; &amp; &#x27; etc."""
    return html_lib.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def _decode_ddg_url(href: str) -> str:
    """
    DDG wraps result URLs as:
      //duckduckgo.com/l/?uddg=https%3A%2F%2F...&rut=...
    Extract and decode the real URL.
    """
    if href.startswith("//"):
        href = "https:" + href
    if "duckduckgo.com/l/" in href:
        parsed = urllib.parse.urlparse(href)
        params = urllib.parse.parse_qs(parsed.query)
        if "uddg" in params:
            return params["uddg"][0]
    return href


# ── Source: Reddit ────────────────────────────────────────────────────────────
def search_reddit(query: str, limit: int, now: int) -> list[dict]:
    url = (
        "https://www.reddit.com/search.json"
        f"?q={urllib.parse.quote(query)}&sort=relevance&t=month&limit={limit}&type=link"
    )
    data = fetch_json(url)
    if not data:
        return []
    articles = []
    for child in data.get("data", {}).get("children", []):
        p = child.get("data", {})
        ts = int(p.get("created_utc", 0))
        if now - ts > DAYS_30:
            continue
        title = p.get("title", "")
        snippet = (p.get("selftext") or p.get("url", ""))[:400]
        if not is_relevant(title, snippet, query):
            continue
        upvotes = p.get("score", 0)
        comments = p.get("num_comments", 0)
        articles.append({
            "id": f"reddit_{p.get('id', '')}",
            "source": "Reddit",
            "title": title,
            "url": "https://reddit.com" + p.get("permalink", ""),
            "subreddit": p.get("subreddit_name_prefixed", ""),
            "upvotes": upvotes,
            "comments": comments,
            "date_ts": ts,
            "date": fmt_date(ts),
            "score": engagement_score(upvotes, comments, ts, now),
            "snippet": snippet,
            "tags": [],
        })
    return articles


# ── Source: Hacker News (Algolia) ─────────────────────────────────────────────
def search_hn(query: str, limit: int, now: int) -> list[dict]:
    cutoff = now - DAYS_30
    url = (
        "https://hn.algolia.com/api/v1/search"
        f"?query={urllib.parse.quote(query)}&tags=story"
        f"&numericFilters=created_at_i>{cutoff}&hitsPerPage={limit}"
    )
    data = fetch_json(url)
    if not data:
        return []
    articles = []
    for hit in data.get("hits", []):
        ts = hit.get("created_at_i", 0)
        title = hit.get("title", "")
        snippet = (hit.get("story_text") or "")[:400]
        if not is_relevant(title, snippet, query):
            continue
        upvotes = hit.get("points") or 0
        comments = hit.get("num_comments") or 0
        obj_id = hit.get("objectID", "")
        link = hit.get("url") or f"https://news.ycombinator.com/item?id={obj_id}"
        articles.append({
            "id": f"hn_{obj_id}",
            "source": "HackerNews",
            "title": title,
            "url": link,
            "subreddit": "",
            "upvotes": upvotes,
            "comments": comments,
            "date_ts": ts,
            "date": fmt_date(ts),
            "score": engagement_score(upvotes, comments, ts, now),
            "snippet": snippet,
            "tags": [],
        })
    return articles


# ── Source: Dev.to ────────────────────────────────────────────────────────────
def search_devto(query: str, limit: int, now: int) -> list[dict]:
    cutoff = now - DAYS_30
    # Use proper search endpoint (no `top=30` — that returns "popular of all time"
    # which gives poor relevance for specific topics)
    url = (
        "https://dev.to/api/articles"
        f"?per_page={min(limit, 30)}&q={urllib.parse.quote(query)}"
    )
    data = fetch_json(url, extra_headers={"Accept": "application/json"})
    if not isinstance(data, list):
        return []
    articles = []
    for a in data:
        published = a.get("published_at") or ""
        try:
            ts = int(datetime.datetime.fromisoformat(published.replace("Z", "+00:00")).timestamp())
        except Exception:
            continue
        if ts < cutoff:
            continue
        title = a.get("title", "")
        snippet = (a.get("description") or "")[:400]
        if not is_relevant(title, snippet, query):
            continue
        upvotes = a.get("positive_reactions_count") or 0
        comments = a.get("comments_count") or 0
        articles.append({
            "id": f"devto_{a.get('id', '')}",
            "source": "DevTo",
            "title": title,
            "url": a.get("url", ""),
            "subreddit": (a.get("user") or {}).get("name", ""),
            "upvotes": upvotes,
            "comments": comments,
            "date_ts": ts,
            "date": fmt_date(ts),
            "score": engagement_score(upvotes, comments, ts, now),
            "snippet": snippet,
            "tags": (a.get("tag_list") or [])[:5],
        })
    return articles


# ── Source: GitHub (Search API, 60 req/hr unauthenticated) ───────────────────
def search_github(query: str, limit: int, now: int) -> list[dict]:
    since = datetime.datetime.fromtimestamp(now - DAYS_30, datetime.UTC).strftime("%Y-%m-%d")
    url = (
        "https://api.github.com/search/repositories"
        f"?q={urllib.parse.quote(query)}+created:>{since}"
        f"&sort=stars&order=desc&per_page={min(limit, 30)}"
    )
    data = fetch_json(url, extra_headers={
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    if not data or "items" not in data:
        return []
    articles = []
    for repo in data["items"]:
        created = repo.get("created_at", "")
        try:
            ts = int(datetime.datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp())
        except Exception:
            continue
        title = repo.get("full_name", "")
        snippet = (repo.get("description") or "")[:400]
        # For GitHub, relax threshold slightly — repo name may contain the term
        if not is_relevant(title, snippet, query, threshold=0.2):
            continue
        stars = repo.get("stargazers_count") or 0
        forks = repo.get("forks_count") or 0
        articles.append({
            "id": f"github_{repo.get('id', '')}",
            "source": "GitHub",
            "title": title,
            "url": repo.get("html_url", ""),
            "subreddit": repo.get("language") or "",
            "upvotes": stars,
            "comments": forks,
            "date_ts": ts,
            "date": fmt_date(ts),
            "score": engagement_score(stars, forks, ts, now),
            "snippet": snippet,
            "tags": (repo.get("topics") or [])[:5],
        })
    return articles


# ── Source: DuckDuckGo (HTML) ─────────────────────────────────────────────────
def search_ddg(query: str, limit: int, now: int) -> list[dict]:
    """
    Scrapes DuckDuckGo HTML endpoint.
    DDG wraps result URLs as redirect links — we decode the real URL from
    the `uddg` query parameter.
    """
    q = urllib.parse.quote(query)
    html = fetch_html(f"https://html.duckduckgo.com/html/?q={q}")
    if not html:
        return []

    # Extract (href, title) pairs — DDG uses class="result__a"
    title_pat = re.compile(
        r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        re.DOTALL,
    )
    # Snippets use class="result__snippet"
    snip_pat = re.compile(
        r'class="result__snippet"[^>]*>(.*?)</(?:a|div|span|td)',
        re.DOTALL,
    )

    pairs = title_pat.findall(html)
    snippets_raw = snip_pat.findall(html)

    articles = []
    for i, (raw_href, title_html) in enumerate(pairs):
        if i >= limit:
            break
        url = _decode_ddg_url(raw_href.replace("&amp;", "&"))
        # Skip DDG-internal pages (bang redirects, settings, etc.)
        if not url.startswith("http") or "duckduckgo.com" in url:
            continue
        title = _strip(title_html)
        if not title:
            continue
        snippet = ""
        if i < len(snippets_raw):
            snippet = _strip(snippets_raw[i])
        if not is_relevant(title, snippet, query):
            continue
        # DDG doesn't give dates — assign a synthetic decreasing timestamp
        ts = now - i * 3600
        articles.append({
            "id": f"ddg_{i}",
            "source": "DuckDuckGo",
            "title": title,
            "url": url,
            "subreddit": "",
            "upvotes": 0,
            "comments": 0,
            "date_ts": ts,
            "date": "Recent",
            "score": max(0.1, 5.0 - i * 0.3),
            "snippet": snippet[:400],
            "tags": [],
        })
    return articles


# ── Claude prompt builder ─────────────────────────────────────────────────────
def build_prompt(query: str, articles: list[dict]) -> str:
    top = articles[:10]
    sources = "\n".join(
        f"- [{a['title'][:80]}]({a['url']}) — {a['source']}, {a['date']}, ↑{a['upvotes']}"
        for a in top
    )
    excerpts = "\n\n".join(
        f"**{a['title'][:80]}** ({a['source']}, {a['date']})\n{a['snippet'][:250]}"
        for a in top[:6]
        if a["snippet"]
    )
    return (
        f'Based on recent community discussions about "{query}" (last 30 days), '
        "here are the key sources. Please synthesise these into:\n"
        "1. The main patterns and best practices the community has converged on\n"
        "2. Key warnings or gotchas mentioned repeatedly\n"
        "3. Your recommended approach given this real-world context\n\n"
        f"SOURCES:\n{sources}\n\n"
        f"COMMUNITY EXCERPTS:\n{excerpts}\n\n"
        "Please provide a practical synthesis I can act on today."
    )


# ── Search dispatch ───────────────────────────────────────────────────────────
SOURCE_FNS = {
    "reddit": search_reddit,
    "hn": search_hn,
    "devto": search_devto,
    "github": search_github,
    "ddg": search_ddg,
}

LIMITS = {
    "quick":    {"reddit": 15, "hn": 15, "devto": 15, "github": 15, "ddg": 10},
    "standard": {"reddit": 30, "hn": 25, "devto": 20, "github": 20, "ddg": 15},
    "deep":     {"reddit": 50, "hn": 40, "devto": 30, "github": 25, "ddg": 20},
}


# ── API ───────────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "sources": list(SOURCE_FNS.keys())})


@app.route("/api/search")
def api_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing query parameter 'q'"}), 400

    mode = request.args.get("mode", "standard")
    if mode not in LIMITS:
        mode = "standard"

    sources_param = request.args.get("sources", "reddit,hn,devto,github")
    active = [
        s.strip().lower()
        for s in sources_param.split(",")
        if s.strip().lower() in SOURCE_FNS
    ]
    if not active:
        active = ["reddit", "hn"]

    # --- CACHE CHECK ---
    cache_key = f"{query}_{mode}_{','.join(sorted(active))}".lower()
    now = _now()
    if cache_key in SEARCH_CACHE:
        timestamp, cached_data = SEARCH_CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            # Update timestamp to slide the window (optional)
            SEARCH_CACHE[cache_key] = (now, cached_data)
            return jsonify(cached_data)

    limits = LIMITS[mode]
    all_articles: list[dict] = []
    sources_found: dict[str, int] = {}
    sources_errors: dict[str, str] = {}

    def _run_source(src):
        with _scrape_semaphore:
            return SOURCE_FNS[src](query, limits[src], now)

    with ThreadPoolExecutor(max_workers=len(active)) as ex:
        futures = {
            ex.submit(_run_source, src): src
            for src in active
        }
        for future in as_completed(futures, timeout=25):
            src = futures[future]
            try:
                results = future.result(timeout=20)
                sources_found[src] = len(results)
                all_articles.extend(results)
            except Exception as e:
                sources_found[src] = 0
                sources_errors[src] = str(e)

    # Sort newest first (primary), then by engagement score (secondary)
    all_articles.sort(key=lambda a: (a["date_ts"], a["score"]), reverse=True)

    response_data = {
        "query": query,
        "mode": mode,
        "sources_queried": active,
        "sources_found": sources_found,
        "sources_errors": sources_errors,
        "articles": all_articles,
        "stats": {
            "total": len(all_articles),
            "upvotes": sum(a["upvotes"] for a in all_articles),
            "comments": sum(a["comments"] for a in all_articles),
        },
        "claude_prompt": build_prompt(query, all_articles),
    }

    # --- SAVE TO CACHE ---
    SEARCH_CACHE[cache_key] = (now, response_data)

    return jsonify(response_data)


# ── Serve built React SPA ────────────────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path: str):
    dist = os.path.abspath(DIST_DIR)
    file_path = os.path.join(dist, path)
    if path and os.path.exists(file_path):
        return send_from_directory(dist, path)
    index = os.path.join(dist, "index.html")
    if os.path.exists(index):
        return send_from_directory(dist, "index.html")
    return jsonify({"info": "Run 'npm run build' in /frontend to serve the UI here"}), 404


# ── Error handlers ───────────────────────────────────────────────────────────
@app.errorhandler(400)
def bad_request(e):
    return jsonify({"status": "error", "error": str(e)}), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "error": str(e)}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"status": "error", "error": str(e)}), 405


@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"status": "error", "error": str(e)}), 500


if __name__ == "__main__":
    print("\n🌐  LatestNews API")
    print("   http://localhost:5000/api/search?q=<topic>&mode=standard&sources=reddit,hn,devto,github,ddg")
    print("   http://localhost:5000  (after: cd frontend && npm run build)\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
