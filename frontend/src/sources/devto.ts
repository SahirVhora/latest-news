import type { Article } from "../types";
import { isRelevant } from "../utils/relevance";
import { fmtDate, engagementScore, DAYS_30_MS } from "./shared";

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  positive_reactions_count: number;
  comments_count: number;
  tag_list: string[];
  user: { name: string };
}

export async function searchDevTo(query: string, limit: number): Promise<Article[]> {
  const url = `https://dev.to/api/articles?per_page=${Math.min(limit, 30)}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json() as DevToArticle[];

  const now = Date.now();
  const cutoff = now - DAYS_30_MS;

  return data.flatMap((a) => {
    const ts = new Date(a.published_at).getTime();
    if (ts < cutoff) return [];
    const title = a.title ?? "";
    const snippet = a.description ?? "";
    if (!isRelevant(title, snippet, query)) return [];
    const upvotes = a.positive_reactions_count ?? 0;
    const comments = a.comments_count ?? 0;
    return [{
      id: `devto_${a.id}`,
      source: "DevTo" as const,
      title,
      url: a.url,
      subreddit: a.user?.name ?? "",
      upvotes,
      comments,
      date_ts: ts,
      date: fmtDate(ts),
      score: engagementScore(upvotes, comments, ts, now),
      snippet: snippet.slice(0, 400),
      tags: (a.tag_list ?? []).slice(0, 5),
    }];
  });
}
