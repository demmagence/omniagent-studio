import { describe, it, expect } from 'vitest';
import { getWordFrequency, calculateCosineSimilarity } from '../src/services/executor';
import { JSONPath } from '../src/services/executors/jsonPath';
import { Prompt } from '../src/services/executors/prompt';
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

  describe('Prompt', () => {
    it('should leave template unmodified if incomingInput is null or undefined', () => {
      const nodeContext = {
        node: { data: { promptTemplate: 'Test {input}' } },
        incomingInput: null
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('Test {input}');

      const nodeContext2 = {
        node: { data: { promptTemplate: 'Test {input}' } },
        incomingInput: undefined
      };
      const result2 = Prompt(nodeContext2 as any as NodeExecutionContext);
      expect(result2.nodeOutput).toBe('Test {input}');
    });

    it('should handle empty promptTemplate and return empty string', () => {
      const nodeContext = {
        node: { data: {} },
        incomingInput: 'test'
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('');
    });

    it('should perform basic string replacement', () => {
      const nodeContext = {
        node: { data: { promptTemplate: 'Hello {input}' } },
        incomingInput: 'World'
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('Hello World');
    });

    it('should handle case-insensitive and multiple replacements', () => {
      const nodeContext = {
        node: { data: { promptTemplate: 'Value: {input}, {INPUT}' } },
        incomingInput: '42'
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('Value: 42, 42');
    });

    it('should handle object input by JSON stringifying', () => {
      const nodeContext = {
        node: { data: { promptTemplate: 'Data: {input}' } },
        incomingInput: { key: 'value' }
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('Data: {"key":"value"}');
    });

    it('should handle number input by stringifying', () => {
      const nodeContext = {
        node: { data: { promptTemplate: 'Count: {input}' } },
        incomingInput: 10
      };
      const result = Prompt(nodeContext as any as NodeExecutionContext);
      expect(result.nodeOutput).toBe('Count: 10');
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

    it('should handle large texts adequately', () => {
      const text = 'word '.repeat(100000);
      const freq = getWordFrequency(text);
      expect(freq.get('word')).toBe(100000);
      expect(freq.size).toBe(1);
    });

    it('should process varied unicode safely (ignoring unsupported characters)', () => {
      const text = 'héllo 🌍 mundo';
      const freq = getWordFrequency(text);
      expect(freq.get('h')).toBe(1);
      expect(freq.get('llo')).toBe(1);
      expect(freq.get('mundo')).toBe(1);
      expect(freq.size).toBe(3);
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
