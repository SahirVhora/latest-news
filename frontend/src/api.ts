import type { SearchResponse, Mode, SourceKey } from "./types";

export async function search(
  query: string,
  mode: Mode,
  sources: SourceKey[]
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    mode,
    sources: sources.join(","),
  });
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<SearchResponse>;
}
