/**
 * Picks a single topic to focus a generation run on, rotating through the
 * user's topic list based on how many articles they've already had generated.
 * This exists because passing the whole topic list into one search query
 * caused the model to drift toward whichever topic is most heavily indexed
 * online (e.g. "fintech" alone tends to surface big-bank news) instead of
 * staying specific. One topic per run keeps the search — and the article —
 * anchored.
 */
export function pickTopic(topics: string[], articlesSoFar: number): string {
  if (!topics || topics.length === 0) return 'marketing and growth';
  return topics[articlesSoFar % topics.length];
}
