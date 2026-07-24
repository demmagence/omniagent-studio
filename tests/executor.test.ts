import { describe, it, expect } from 'vitest';
import { getWordFrequency, calculateCosineSimilarity } from '../src/services/executor';
import { JSONPath } from '../src/services/executors/jsonPath';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('executor utility functions', () => {
  describe('JSONPath', () => {
    it('should block access to __proto__', () => {
      const nodeContext = {
        node: { data: { jsonPath: '__proto__' } },
        incomingInput: { a: 1 }
      };
      const result = JSONPath(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBeUndefined();
    });

    it('should block access to constructor', () => {
      const nodeContext = {
        node: { data: { jsonPath: 'constructor' } },
        incomingInput: { a: 1 }
      };
      const result = JSONPath(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBeUndefined();
    });

    it('should block access to prototype', () => {
      const nodeContext = {
        node: { data: { jsonPath: 'prototype' } },
        incomingInput: { a: 1 }
      };
      const result = JSONPath(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBeUndefined();
    });
  });
  describe('getWordFrequency', () => {
    it('should correctly count word frequencies in a basic string', () => {
      const text = 'hello world hello';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(2);
      expect(freq.get('world')).toBe(1);
      expect(freq.size).toBe(2);
    });

    it('should handle case insensitivity', () => {
      const text = 'Hello WORLD hello World';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(2);
      expect(freq.get('world')).toBe(2);
      expect(freq.size).toBe(2);
    });

    it('should ignore punctuation', () => {
      const text = 'hello, world! hello?';
      const freq = getWordFrequency(text);
      expect(freq.get('hello')).toBe(2);
      expect(freq.get('world')).toBe(1);
      expect(freq.size).toBe(2);
    });

    it('should return an empty map for empty string', () => {
      const freq = getWordFrequency('');
      expect(freq.size).toBe(0);
    });

    it('should return an empty map for string with only punctuation', () => {
      const freq = getWordFrequency('!!! ??? ,,,');
      expect(freq.size).toBe(0);
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
      // freq1 = { hello: 1, world: 1 } -> norm1 = sqrt(2)
      // freq2 = { hello: 1, friend: 1 } -> norm2 = sqrt(2)
      // dot product = 1
      // similarity = 1 / 2 = 0.5
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
