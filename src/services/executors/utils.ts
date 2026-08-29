export function getWordFrequency(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  let start = -1;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    // \w corresponds to [a-zA-Z0-9_]
    const isWordChar =
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 95;

    if (isWordChar) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      const w = text.slice(start, i).toLowerCase();
      freq.set(w, (freq.get(w) || 0) + 1);
      start = -1;
    }
  }

  if (start !== -1) {
    const w = text.slice(start).toLowerCase();
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
