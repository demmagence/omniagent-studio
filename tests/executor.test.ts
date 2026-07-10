import { describe, it, expect } from 'vitest';
import { getWordFrequency, calculateCosineSimilarity } from '../src/services/executor';

describe('executor utility functions', () => {
  describe('getWordFrequency', () => {
    it('should count basic words correctly', () => {
      const text = 'hello world hello';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(2);
      expect(freq.get('world')).toBe(1);
      expect(freq.size).toBe(2);
    });

    it('should be case insensitive', () => {
      const text = 'Hello hello HeLLo';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(3);
      expect(freq.size).toBe(1);
    });

    it('should handle empty strings', () => {
      const text = '';
      const freq = getWordFrequency(text);
      expect(freq.size).toBe(0);
    });

    it('should handle strings with only punctuation', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:\'",.<>/?`~';
      const freq = getWordFrequency(text);
      // The regex \b\w+\b matches letters, digits, and underscores.
      // Notice that _ is matched by \w.
      expect(freq.get('_')).toBe(1);
      expect(freq.size).toBe(1);
    });

    it('should ignore punctuation but keep words', () => {
      const text = 'Hello, world! Welcome to the world.';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(1);
      expect(freq.get('world')).toBe(2);
      expect(freq.get('welcome')).toBe(1);
      expect(freq.get('to')).toBe(1);
      expect(freq.get('the')).toBe(1);
      expect(freq.size).toBe(5);
    });

    it('should handle numbers', () => {
      const text = 'The year is 2023 and 2023 is good';
      const freq = getWordFrequency(text);
      expect(freq.get('the')).toBe(1);
      expect(freq.get('year')).toBe(1);
      expect(freq.get('is')).toBe(2);
      expect(freq.get('2023')).toBe(2);
      expect(freq.get('and')).toBe(1);
      expect(freq.get('good')).toBe(1);
      expect(freq.size).toBe(6);
    });

    it('should handle words with underscores as part of a word', () => {
      const text = 'my_variable is my_variable';
      const freq = getWordFrequency(text);
      expect(freq.get('my_variable')).toBe(2);
      expect(freq.get('is')).toBe(1);
      expect(freq.size).toBe(2);
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should return 1.0 for identical frequencies', () => {
      const freq1 = getWordFrequency('hello world');
      const freq2 = getWordFrequency('hello world');
      const similarity = calculateCosineSimilarity(freq1, freq2);
      // Allowing a small epsilon for floating point math
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for completely disjoint frequencies', () => {
      const freq1 = getWordFrequency('hello world');
      const freq2 = getWordFrequency('goodbye moon');
      const similarity = calculateCosineSimilarity(freq1, freq2);
      expect(similarity).toBe(0.0);
    });

    it('should calculate correct similarity for overlapping frequencies', () => {
      const freq1 = getWordFrequency('hello world');
      const freq2 = getWordFrequency('hello friend');
      const similarity = calculateCosineSimilarity(freq1, freq2);
      expect(similarity).toBeCloseTo(0.5, 5);
    });

    it('should return 0 when one or both documents are empty', () => {
      const emptyFreq = new Map<string, number>();
      const freq = getWordFrequency('hello world');

      expect(calculateCosineSimilarity(emptyFreq, freq)).toBe(0);
      expect(calculateCosineSimilarity(freq, emptyFreq)).toBe(0);
      expect(calculateCosineSimilarity(emptyFreq, emptyFreq)).toBe(0);
    });
  });
});
