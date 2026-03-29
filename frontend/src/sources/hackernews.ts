import type { Article } from "../types";
import { isRelevant } from "../utils/relevance";
import { fmtDate, engagementScore, DAYS_30_MS } from "./shared";

export async function searchHN(query: string, limit: number): Promise<Article[]> {
  const cutoff = Math.floor((Date.now() - DAYS_30_MS) / 1000);
  const url =
    `https://hn.algolia.com/api/v1/search` +
    `?query=${encodeURIComponent(query)}&tags=story` +
    `&numericFilters=created_at_i>${cutoff}&hitsPerPage=${limit}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { hits: Record<string, unknown>[] };

  const now = Date.now();
  return data.hits.flatMap((hit) => {
    const ts = (hit.created_at_i as number) * 1000;
    const title = (hit.title as string) ?? "";
    const snippet = (hit.story_text as string) ?? "";
    if (!isRelevant(title, snippet, query)) return [];
    const upvotes = (hit.points as number) ?? 0;
    const comments = (hit.num_comments as number) ?? 0;
    const id = hit.objectID as string;
    return [{
      id: `hn_${id}`,
      source: "HackerNews" as const,
      title,
      url: (hit.url as string) || `https://news.ycombinator.com/item?id=${id}`,
      subreddit: "",
      upvotes,
      comments,
      date_ts: ts,
      date: fmtDate(ts),
      score: engagementScore(upvotes, comments, ts, now),
      snippet: snippet.slice(0, 400),
      tags: [],
    }];
  });
}
