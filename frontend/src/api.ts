import { searchHN } from "./sources/hackernews";
import { searchDevTo } from "./sources/devto";
import { searchGitHub } from "./sources/github";
import { searchReddit } from "./sources/reddit";
import type { Article, Mode, SearchResponse, SourceKey } from "./types";

const LIMITS: Record<Mode, Record<string, number>> = {
  quick:    { reddit: 15, hn: 15, devto: 15, github: 15 },
  standard: { reddit: 30, hn: 25, devto: 20, github: 20 },
  deep:     { reddit: 50, hn: 40, devto: 30, github: 25 },
};

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try { return await fn(); } catch { return []; }
}

function buildPrompt(query: string, articles: Article[]): string {
  const top = articles.slice(0, 10);
  const sources = top
    .map((a) => `- [${a.title.slice(0, 80)}](${a.url}) — ${a.source}, ${a.date}, ↑${a.upvotes}`)
    .join("\n");
  const excerpts = top
    .filter((a) => a.snippet)
    .slice(0, 6)
    .map((a) => `**${a.title.slice(0, 80)}** (${a.source}, ${a.date})\n${a.snippet.slice(0, 250)}`)
    .join("\n\n");
  return (
    `Based on recent community discussions about "${query}" (last 30 days), ` +
    `here are the key sources. Please synthesise these into:\n` +
    `1. The main patterns and best practices the community has converged on\n` +
    `2. Key warnings or gotchas mentioned repeatedly\n` +
    `3. Your recommended approach given this real-world context\n\n` +
    `SOURCES:\n${sources}\n\nCOMMUNITY EXCERPTS:\n${excerpts}\n\n` +
    `Please provide a practical synthesis I can act on today.`
  );
}

export async function search(
  query: string,
  mode: Mode,
  sources: SourceKey[],
): Promise<SearchResponse> {
  const limits = LIMITS[mode];

  const sourceMap: Record<SourceKey, () => Promise<Article[]>> = {
    reddit: () => searchReddit(query, limits.reddit ?? 25),
    hn:     () => searchHN(query,     limits.hn     ?? 20),
    devto:  () => searchDevTo(query,  limits.devto  ?? 15),
    github: () => searchGitHub(query, limits.github ?? 15),
  };

  // Fetch all selected sources in parallel — failures return empty arrays
  const results = await Promise.all(
    sources.map((src) => safe(sourceMap[src] ?? (() => Promise.resolve([]))))
  );

  const articles = results
    .flat()
    .sort((a, b) => b.date_ts - a.date_ts || b.score - a.score);

  const sourcesFound = Object.fromEntries(
    sources.map((src, i) => [src, results[i]?.length ?? 0])
  );

  return {
    query,
    mode,
    sources_queried: sources,
    sources_found: sourcesFound,
    sources_errors: {},
    articles,
    stats: {
      total: articles.length,
      upvotes: articles.reduce((s, a) => s + a.upvotes, 0),
      comments: articles.reduce((s, a) => s + a.comments, 0),
    },
    claude_prompt: buildPrompt(query, articles),
  };
}
