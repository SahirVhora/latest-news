import type { Article } from "../types";
import { isRelevant } from "../utils/relevance";
import { fmtDate, engagementScore, DAYS_30_MS } from "./shared";

interface GHRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
}

export async function searchGitHub(query: string, limit: number): Promise<Article[]> {
  const since = new Date(Date.now() - DAYS_30_MS).toISOString().slice(0, 10);
  const url =
    `https://api.github.com/search/repositories` +
    `?q=${encodeURIComponent(query)}+created:>${since}&sort=stars&order=desc&per_page=${Math.min(limit, 30)}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return [];
  const data = await res.json() as { items: GHRepo[] };

  const now = Date.now();
  return (data.items ?? []).flatMap((repo) => {
    const ts = new Date(repo.created_at).getTime();
    const title = repo.full_name;
    const snippet = repo.description ?? "";
    if (!isRelevant(title, snippet, query, 0.2)) return [];
    const stars = repo.stargazers_count ?? 0;
    const forks = repo.forks_count ?? 0;
    return [{
      id: `github_${repo.id}`,
      source: "GitHub" as const,
      title,
      url: repo.html_url,
      subreddit: repo.language ?? "",
      upvotes: stars,
      comments: forks,
      date_ts: ts,
      date: fmtDate(ts),
      score: engagementScore(stars, forks, ts, now),
      snippet: snippet.slice(0, 400),
      tags: (repo.topics ?? []).slice(0, 5),
    }];
  });
}
