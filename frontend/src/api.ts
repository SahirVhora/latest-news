import type { SearchResponse, Mode, SourceKey } from "./types";

// In dev: empty string → Vite proxies /api/* to localhost:5000
// In production (GitHub Pages): points directly to the Render backend
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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
  const res = await fetch(`${API_BASE}/api/search?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<SearchResponse>;
}
