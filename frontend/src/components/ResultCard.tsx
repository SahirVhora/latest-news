import type { Article } from "../types";
import { SOURCE_COLORS } from "../types";

interface Props {
  article: Article;
  relevance?: { label: string; why: string; confidence: number };
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function ResultCard({ article, relevance }: Props) {
  const {
    source, title, url, date, upvotes, comments, snippet, subreddit, tags,
  } = article;

  const isGitHub = source === "GitHub";
  const upvoteLabel = isGitHub ? "★" : "↑";
  const commentLabel = isGitHub ? "forks" : "comments";

  return (
    <article className="card flex flex-col gap-3 group">
      {relevance && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div>
            <div className="text-xs font-bold text-amber-300">{relevance.label}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{relevance.why}</div>
          </div>
          <span className="shrink-0 rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300" title="Source confidence">
            {relevance.confidence}%
          </span>
        </div>
      )}

      {/* Source + date row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`badge ${SOURCE_COLORS[source]}`}>{source}</span>
          {subreddit && (
            <span className="text-xs text-slate-500 truncate">{subreddit}</span>
          )}
        </div>
        <span className="text-xs text-slate-500 shrink-0">{date}</span>
      </div>

      {/* Title */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-slate-100 leading-snug hover:text-amber-400 transition-colors duration-150 line-clamp-3 group-hover:text-amber-400"
      >
        {title}
      </a>

      {/* Snippet */}
      {snippet && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 max-h-[4.5rem] overflow-hidden border-l-2 border-navy-700 pl-2">
          {snippet}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <span key={t} className="badge bg-navy-800 text-slate-400 border border-navy-700">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Engagement + link */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {(upvotes > 0 || comments > 0) && (
            <>
              <span title={`${upvotes.toLocaleString()} ${isGitHub ? "stars" : "upvotes"}`}>
                {upvoteLabel} {fmt(upvotes)}
              </span>
              <span title={`${comments.toLocaleString()} ${commentLabel}`}>
                {isGitHub ? "⑂" : "💬"} {fmt(comments)}
              </span>
            </>
          )}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
        >
          Open ↗
        </a>
      </div>
    </article>
  );
}
