/** Extract significant words (len ≥ 3) from query */
function queryTerms(query: string): string[] {
  return query.split(/\W+/).filter((w) => w.length >= 3).map((w) => w.toLowerCase());
}

/**
 * Returns fraction of query terms found in title + snippet.
 * Title matches are weighted 2× snippet matches.
 * Returns 1.0 when query has no significant terms (passthrough).
 */
export function relevanceScore(title: string, snippet: string, query: string): number {
  const terms = queryTerms(query);
  if (terms.length === 0) return 1;
  const tl = title.toLowerCase();
  const sl = snippet.toLowerCase();
  const score = terms.reduce((acc, t) => {
    if (tl.includes(t)) return acc + 2;
    if (sl.includes(t)) return acc + 1;
    return acc;
  }, 0);
  return score / (terms.length * 2);
}

export function isRelevant(title: string, snippet: string, query: string, threshold = 0.25): boolean {
  return relevanceScore(title, snippet, query) >= threshold;
}
