export function getWordFrequency(text: string): Map<string, number> {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

export function calculateCosineSimilarity(freq1: Map<string, number>, freq2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const [word, count] of freq1.entries()) {
    norm1 += count * count;
    if (freq2.has(word)) {
      dotProduct += count * (freq2.get(word) || 0);
    }
  }

  for (const count of freq2.values()) {
    norm2 += count * count;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
