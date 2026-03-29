export type Source = "Reddit" | "HackerNews" | "DevTo" | "GitHub";

export interface Article {
  id: string;
  source: Source;
  title: string;
  url: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  date_ts: number;
  date: string;
  score: number;
  snippet: string;
  tags: string[];
}

export interface SearchStats {
  total: number;
  upvotes: number;
  comments: number;
}

export interface SearchResponse {
  query: string;
  mode: string;
  sources_queried: string[];
  sources_found: Record<string, number>;
  sources_errors: Record<string, string>;
  articles: Article[];
  stats: SearchStats;
  claude_prompt: string;
}

export type SortBy = "date" | "engagement";
export type Mode = "quick" | "standard" | "deep";

export const SOURCE_KEYS = ["reddit", "hn", "devto", "github"] as const;
export type SourceKey = typeof SOURCE_KEYS[number];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  reddit: "Reddit",
  hn: "Hacker News",
  devto: "Dev.to",
  github: "GitHub",
};

export const SOURCE_COLORS: Record<Source, string> = {
  Reddit:      "bg-reddit/20 text-[#ff6633] border border-reddit/30",
  HackerNews:  "bg-hn/20 text-[#ff8c42] border border-hn/30",
  DevTo:       "bg-devto/20 text-purple-400 border border-devto/30",
  GitHub:      "bg-github/20 text-slate-300 border border-github/30",
};

export const SOURCE_DOT: Record<Source, string> = {
  Reddit:     "bg-reddit",
  HackerNews: "bg-hn",
  DevTo:      "bg-devto",
  GitHub:     "bg-github",
};
