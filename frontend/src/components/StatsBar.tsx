import type { SearchStats, SortBy, Source } from "../types";
import { SOURCE_COLORS } from "../types";

interface Props {
  stats: SearchStats;
  sourcesFound: Record<string, number>;
  sourcesErrors: Record<string, string>;
  availableSources: string[];
  filterSource: string | null;
  setFilterSource: (s: string | null) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  query: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

const SOURCE_DISPLAY: Record<string, string> = {
  reddit: "Reddit",
  hn: "HN",
  devto: "Dev.to",
  github: "GitHub",
  ddg: "DDG",
};

export function StatsBar({
  stats, sourcesFound, sourcesErrors, availableSources,
  filterSource, setFilterSource, sortBy, setSortBy, query,
}: Props) {

  return (
    <div className="space-y-3">
      {/* Headline */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-300">
          <span className="text-amber-400">{stats.total}</span> relevant results for{" "}
          <span className="text-slate-100">&ldquo;{query}&rdquo;</span>
        </h2>

        <div className="flex gap-2 ml-auto flex-wrap items-center">
          {stats.upvotes > 0 && (
            <span className="text-xs bg-navy-800 border border-navy-700 rounded-full px-3 py-1 text-slate-400">
              ↑ {fmt(stats.upvotes)} upvotes
            </span>
          )}
          {stats.comments > 0 && (
            <span className="text-xs bg-navy-800 border border-navy-700 rounded-full px-3 py-1 text-slate-400">
              💬 {fmt(stats.comments)} comments
            </span>
          )}
        </div>
      </div>

      {/* Per-source breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(sourcesFound).map(([src, count]) => {
          const hasError = src in sourcesErrors;
          const isZero = count === 0;
          const label = SOURCE_DISPLAY[src] ?? src;
          const tip = hasError
            ? `Error: ${sourcesErrors[src]}`
            : isZero
            ? "No results matched your topic — relevance filter removed all results"
            : `${count} result${count === 1 ? "" : "s"} found`;

          return (
            <span
              key={src}
              title={tip}
              className={`text-xs rounded-full px-3 py-1 border cursor-default transition-colors ${
                hasError
                  ? "bg-red-950/40 border-red-800/50 text-red-400"
                  : isZero
                  ? "bg-navy-800/50 border-navy-700/50 text-slate-600"
                  : "bg-navy-800 border-navy-700 text-slate-400"
              }`}
            >
              {label}:{" "}
              <span className={isZero || hasError ? "text-slate-600" : "text-slate-300 font-semibold"}>
                {hasError ? "err" : count}
              </span>
            </span>
          );
        })}
      </div>

      {/* Zero-result explanation banner */}
      {Object.entries(sourcesFound).some(([, c]) => c === 0) && (
        <p className="text-xs text-slate-600 bg-navy-900 border border-navy-800 rounded-lg px-3 py-2">
          <span className="text-slate-500">ℹ</span> Sources showing{" "}
          <span className="text-slate-400">0</span> had results but none matched your topic —
          the relevance filter removed off-topic articles. Try{" "}
          <span className="text-amber-500/80">Deep</span> mode for broader coverage.
        </p>
      )}

      {/* Filter + Sort row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-800 pb-3">
        {/* Source filter tabs */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => setFilterSource(null)}
            className={`source-tab ${
              filterSource === null
                ? "bg-navy-700 text-slate-200 border border-navy-600"
                : "text-slate-500 border border-navy-800 hover:border-navy-700"
            }`}
          >
            All
          </button>
          {availableSources.map((src) => (
            <button
              key={src}
              onClick={() => setFilterSource(filterSource === src ? null : src)}
              className={`source-tab ${
                filterSource === src
                  ? `${SOURCE_COLORS[src as Source]} !border-current`
                  : "text-slate-500 border border-navy-800 hover:border-navy-700"
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        {/* Sort control */}
        <div className="flex items-center gap-1 bg-navy-900 rounded-lg p-1 border border-navy-800 shrink-0">
          <button
            onClick={() => setSortBy("date")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              sortBy === "date" ? "bg-amber-500 text-navy-950" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortBy("engagement")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              sortBy === "engagement" ? "bg-amber-500 text-navy-950" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Top
          </button>
        </div>
      </div>
    </div>
  );
}
