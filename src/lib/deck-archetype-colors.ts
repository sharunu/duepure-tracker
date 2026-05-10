const ARCHETYPE_REGISTRY: Record<string, string> = {
  "その他": "var(--chart-8)",
};

function hashToChartIndex(deckName: string): number {
  let h = 0;
  for (const ch of deckName) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h) % 8;
}

export function colorForArchetype(deckName: string): string {
  const registered = ARCHETYPE_REGISTRY[deckName];
  if (registered) return registered;
  return `var(--chart-${hashToChartIndex(deckName) + 1})`;
}
