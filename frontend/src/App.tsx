import { useCallback, useEffect, useRef, useState } from "react";
import { search } from "./api";
import { ClaudePromptBox } from "./components/ClaudePromptBox";
import { LoadingCards } from "./components/LoadingCards";
import { ResultCard } from "./components/ResultCard";
import { StatsBar } from "./components/StatsBar";
import type { Article, Mode, Source, SearchResponse, SortBy, SourceKey } from "./types";
import { SOURCE_DOT, SOURCE_KEYS, SOURCE_LABELS } from "./types";

const DEFAULT_SOURCES: SourceKey[] = ["reddit", "hn", "devto", "github"];

export default function App() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [mode, setMode] = useState<Mode>("standard");
  const [sources, setSources] = useState<SourceKey[]>(DEFAULT_SOURCES);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ln_recent_searches") ?? "[]"); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFilterSource(null);
    setActiveQuery(q);
    try {
      const data = await search(q, mode, sources);
      setResult(data);
      setRecentSearches((prev) => {
        const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 8);
        localStorage.setItem("ln_recent_searches", JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Auto-retry once — handles Render free-tier cold starts (30-50s wake time)
      setRetrying(true);
      try {
        await new Promise((r) => setTimeout(r, 4000));
        const data = await search(q, mode, sources);
        setResult(data);
      } catch (err2) {
        setError(
          "Could not reach the search server. " +
          "It may be waking up — please wait 30 seconds and try again."
        );
        console.error(err2);
      } finally {
        setRetrying(false);
      }
    } finally {
      setLoading(false);
    }
  }, [query, mode, sources, loading]);

  const toggleSource = (key: SourceKey) => {
    setSources((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((s) => s !== key) : prev
        : [...prev, key]
    );
  };

  const displayedArticles: Article[] = result
    ? (filterSource
        ? result.articles.filter((a) => a.source === filterSource)
        : result.articles
      ).slice().sort((a, b) =>
        sortBy === "date" ? b.date_ts - a.date_ts : b.score - a.score
      )
    : [];

  const availableSources = result
    ? [...new Set(result.articles.map((a) => a.source))]
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-navy-900/95 backdrop-blur border-b border-navy-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight">
              <span className="text-gradient">Latest</span>
              <span className="text-slate-100">News</span>
            </span>
            <span className="hidden sm:block text-xs text-slate-500 border border-navy-700 rounded-full px-2 py-0.5">
              community intelligence
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(["Reddit", "HackerNews", "DevTo", "GitHub"] as Source[]).map((s) => (
              <span key={s} title={s} className={`w-2 h-2 rounded-full ${SOURCE_DOT[s]} opacity-70`} />
            ))}
            <span className="ml-1 text-xs text-slate-500">4 sources</span>
          </div>
        </div>
      </header>

      {/* ── Hero / Search Panel ── */}
      <section className={`bg-gradient-to-b from-navy-800 to-navy-950 transition-all duration-500 ${result || loading ? "py-6" : "py-16 sm:py-24"}`}>
        <div className="max-w-3xl mx-auto px-4">
          {!result && !loading && (
            <div className="text-center mb-8 animate-fade-in">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
                <span className="text-gradient">Latest</span>
                <span className="text-slate-100">News</span>
              </h1>
              <p className="text-slate-400 text-lg">
                Real-time community intelligence across Reddit, HN, Dev.to &amp; GitHub.
                <br className="hidden sm:block" /> Zero API keys. Always free.
              </p>
            </div>
          )}

          {/* Search input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                className="input-search pr-10"
                placeholder='Search any topic… e.g. "SAP SuccessFactors", "AI agents"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {!loading && (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 hidden sm:block">
                  /
                </kbd>
              )}
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button className="btn-primary whitespace-nowrap" onClick={() => handleSearch()} disabled={loading || !query.trim()}>
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Recent searches chips */}
          {!result && !loading && recentSearches.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 shrink-0">Recent searches:</span>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); handleSearch(s); }}
                  className="text-xs px-2.5 py-1 rounded-full bg-navy-800 border border-navy-700 text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* Mode */}
            <div className="flex items-center gap-1 bg-navy-900 rounded-lg p-1 border border-navy-800">
              {(["quick", "standard", "deep"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 capitalize ${
                    mode === m
                      ? "bg-amber-500 text-navy-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Sources */}
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => toggleSource(key)}
                  className={`source-tab ${
                    sources.includes(key)
                      ? "bg-navy-700 text-slate-200 border border-navy-600"
                      : "text-slate-500 border border-navy-800 hover:border-navy-700"
                  }`}
                >
                  {SOURCE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm animate-fade-in">
            <strong>Error:</strong> {error}
            <button className="ml-3 underline text-red-400 hover:text-red-200" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        {/* Loading / waking up */}
        {loading && !retrying && <LoadingCards />}
        {retrying && (
          <div className="flex flex-col items-center gap-3 py-16 animate-fade-in">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Server waking up — retrying automatically…</p>
            <p className="text-slate-600 text-xs">Free hosting sleeps after inactivity. Usually ready in &lt;30s.</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="animate-slide-up">
            {/* Stats + filter bar */}
            <StatsBar
              stats={result.stats}
              sourcesFound={result.sources_found}
              sourcesErrors={result.sources_errors ?? {}}
              availableSources={availableSources}
              filterSource={filterSource}
              setFilterSource={setFilterSource}
              sortBy={sortBy}
              setSortBy={setSortBy}
              query={activeQuery}
            />

            {/* Card grid */}
            {displayedArticles.length === 0 ? (
              <p className="text-center text-slate-500 py-16">No results for this filter.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                {displayedArticles.map((article) => (
                  <ResultCard key={article.id} article={article} />
                ))}
              </div>
            )}

            {/* Claude prompt */}
            <div className="mt-8">
              <ClaudePromptBox prompt={result.claude_prompt} query={activeQuery} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16 text-slate-600 animate-fade-in">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-medium text-slate-500">Enter a topic to get started</p>
            <p className="text-sm mt-1">Searches Reddit, Hacker News, Dev.to and GitHub simultaneously</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-navy-800 py-6 px-4 text-center text-xs text-slate-600">
        <span className="font-semibold text-slate-500">LatestNews</span> — community intelligence, zero API keys &nbsp;·&nbsp;
        <a href="https://github.com" className="hover:text-slate-400 transition-colors">GitHub</a>
      </footer>
    </div>
  );
}
