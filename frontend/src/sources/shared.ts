export const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function engagementScore(upvotes: number, comments: number, ts: number, now: number): number {
  const recency = Math.max(0, 1 - (now - ts) / DAYS_30_MS);
  return Math.round((upvotes + comments * 2) * (0.4 + 0.6 * recency) * 10) / 10;
}
