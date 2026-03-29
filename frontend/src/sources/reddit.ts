import type { Article } from "../types";
import { isRelevant } from "../utils/relevance";
import { fmtDate, engagementScore, DAYS_30_MS, decodeHtml } from "./shared";

// corsproxy.io adds the required CORS headers so the browser can reach Reddit's JSON API
const PROXY = "https://corsproxy.io/?url=";

interface RedditChild {
  data: {
    id: string;
    title: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
    selftext: string;
    url: string;
    subreddit_name_prefixed: string;
  };
}

export async function searchReddit(query: string, limit: number): Promise<Article[]> {
  const redditUrl =
    `https://www.reddit.com/search.json` +
    `?q=${encodeURIComponent(query)}&sort=relevance&t=month&limit=${limit}&type=link`;

  const res = await fetch(PROXY + encodeURIComponent(redditUrl), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json() as { data: { children: RedditChild[] } };

  const now = Date.now();
  const cutoff = now - DAYS_30_MS;

  return (data.data?.children ?? []).flatMap(({ data: p }) => {
    const ts = p.created_utc * 1000;
    if (ts < cutoff) return [];
    const title = decodeHtml(p.title ?? "");
    const snippet = decodeHtml((p.selftext || p.url || "").slice(0, 400));
    if (!isRelevant(title, snippet, query)) return [];
    const upvotes = p.score ?? 0;
    const comments = p.num_comments ?? 0;
    return [{
      id: `reddit_${p.id}`,
      source: "Reddit" as const,
      title,
      url: `https://reddit.com${p.permalink}`,
      subreddit: p.subreddit_name_prefixed ?? "",
      upvotes,
      comments,
      date_ts: ts,
      date: fmtDate(ts),
      score: engagementScore(upvotes, comments, ts, now),
      snippet,
      tags: [],
    }];
  });
}
