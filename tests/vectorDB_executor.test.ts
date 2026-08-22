import { describe, it, expect } from 'vitest';
import { VectorDB } from '../src/services/executors/vectorDB';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('VectorDB executor', () => {
  const createMockContext = (
    incomingInput: any,
    documents?: string,
    similarityThreshold?: number,
    embeddingModel?: string
  ): NodeExecutionContext => {
    return {
      node: {
        id: 'vector-1',
        type: 'VectorDB',
        position: { x: 0, y: 0 },
        data: {
          ...(documents !== undefined && { documents }),
          ...(similarityThreshold !== undefined && { similarityThreshold }),
          ...(embeddingModel !== undefined && { embeddingModel }),
        },
      },
      incomingInput,
    } as NodeExecutionContext;
  };

  it('should query documents using string input and return results ordered by similarity', () => {
    const docs = 'apple pie recipe\nbanana bread\napple tart dessert';
    const context = createMockContext('apple pie', docs, 0.1, 'text-embedding-3-small');

    const result = VectorDB(context);

    expect(result.nodeInput).toBe('apple pie');
    expect(result.nodeOutput).toEqual(['apple pie recipe', 'apple tart dessert']);
    expect(result.tokensUsed).toBe(0);
    expect(result.log).toBe(
      'Running VectorDB query on 3 documents using model: text-embedding-3-small with threshold 0.1. Found 2 matching documents.'
    );
  });

  it('should include all documents when threshold is 0 sorted by similarity', () => {
    const docs = 'apple pie recipe\nbanana bread\napple tart dessert';
    const context = createMockContext('apple pie', docs, 0);

    const result = VectorDB(context);

    expect(result.nodeOutput).toEqual(['apple pie recipe', 'apple tart dessert', 'banana bread']);
  });

  it('should handle object input by JSON stringifying it', () => {
    const docs = 'machine learning algorithms\nweb development with react\ndata science';
    const context = createMockContext({ topic: 'machine learning' }, docs, 0.1);

    const result = VectorDB(context);

    expect(result.nodeInput).toBe('{"topic":"machine learning"}');
    expect(result.nodeOutput).toEqual(['machine learning algorithms']);
    expect(result.log).toContain('using model: default with threshold 0.1');
  });

  it('should handle null or undefined input as empty string query', () => {
    const docs = 'document one\ndocument two';
    const contextNull = createMockContext(null, docs, 0.1);
    const contextUndefined = createMockContext(undefined, docs, 0.1);

    const resultNull = VectorDB(contextNull);
    expect(resultNull.nodeInput).toBe('');
    expect(resultNull.nodeOutput).toEqual([]);

    const resultUndefined = VectorDB(contextUndefined);
    expect(resultUndefined.nodeInput).toBe('');
    expect(resultUndefined.nodeOutput).toEqual([]);
  });

  it('should filter matches based on similarityThreshold', () => {
    const docs = 'quick brown fox\nlazy dog\nquick red fox';
    // With query "quick brown fox", "quick brown fox" has higher similarity than "quick red fox"
    const contextLowThreshold = createMockContext('quick brown fox', docs, 0.1);
    const resultLow = VectorDB(contextLowThreshold);
    expect(resultLow.nodeOutput).toContain('quick brown fox');
    expect(resultLow.nodeOutput).toContain('quick red fox');
    expect(resultLow.nodeOutput).not.toContain('lazy dog');

    const contextHighThreshold = createMockContext('quick brown fox', docs, 0.9);
    const resultHigh = VectorDB(contextHighThreshold);
    expect(resultHigh.nodeOutput).toEqual(['quick brown fox']);
  });

  it('should handle missing documents and default properties gracefully', () => {
    const context = createMockContext('search query');

    const result = VectorDB(context);

    expect(result.nodeOutput).toEqual([]);
    expect(result.log).toBe(
      'Running VectorDB query on 0 documents using model: default with threshold 0. Found 0 matching documents.'
    );
  });

  it('should leverage cache on subsequent executions with identical documents and queries', () => {
    const docs = 'alpha beta gamma\ndelta epsilon zeta';
    const context1 = createMockContext('alpha', docs, 0.1);
    const context2 = createMockContext('alpha', docs, 0.1);

    const result1 = VectorDB(context1);
    const result2 = VectorDB(context2);

    expect(result1.nodeOutput).toEqual(result2.nodeOutput);
    expect(result1.nodeOutput).toEqual(['alpha beta gamma']);
  });
});
