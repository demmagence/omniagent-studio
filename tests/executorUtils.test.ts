import { describe, it, expect } from 'vitest';
import { getWordFrequency, calculateCosineSimilarity } from '../src/services/executors/utils';

describe('Executor Utils', () => {
  describe('getWordFrequency', () => {
    it('should return an empty map for an empty string', () => {
      const result = getWordFrequency('');
      expect(result.size).toBe(0);
    });

    it('should correctly count case-insensitive words', () => {
      const result = getWordFrequency('Hello hello');
      expect(result.get('hello')).toBe(2);
      expect(result.size).toBe(1);
    });

    it('should ignore punctuation', () => {
      const result = getWordFrequency('hello, world!');
      expect(result.get('hello')).toBe(1);
      expect(result.get('world')).toBe(1);
      expect(result.size).toBe(2);
    });

    it('should handle multiple words correctly', () => {
      const result = getWordFrequency('a b c a');
      expect(result.get('a')).toBe(2);
      expect(result.get('b')).toBe(1);
      expect(result.get('c')).toBe(1);
      expect(result.size).toBe(3);
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should return 0 when both maps are empty', () => {
      const result = calculateCosineSimilarity(new Map(), new Map());
      expect(result).toBe(0);
    });

    it('should return 0 when one map is empty', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map();
      expect(calculateCosineSimilarity(map1, map2)).toBe(0);
      expect(calculateCosineSimilarity(map2, map1)).toBe(0);
    });

    it('should return 1 for identical maps', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(calculateCosineSimilarity(map, map)).toBeCloseTo(1);
    });

    it('should return 0 for completely disjoint maps', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map([['b', 1]]);
      expect(calculateCosineSimilarity(map1, map2)).toBe(0);
    });

    it('should correctly calculate similarity for partially overlapping maps', () => {
      const map1 = new Map([['a', 1], ['b', 1]]);
      const map2 = new Map([['a', 1], ['c', 1]]);
      // (1*1 + 1*0) / (sqrt(1^2 + 1^2) * sqrt(1^2 + 1^2)) = 1 / (sqrt(2) * sqrt(2)) = 1 / 2 = 0.5
      expect(calculateCosineSimilarity(map1, map2)).toBeCloseTo(0.5);
    });

    it('should return 1 for identical frequency distributions (different magnitudes)', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map([['a', 2]]);
      // (1*2) / (sqrt(1^2) * sqrt(2^2)) = 2 / (1 * 2) = 1
      expect(calculateCosineSimilarity(map1, map2)).toBeCloseTo(1);
    });
  });
});
