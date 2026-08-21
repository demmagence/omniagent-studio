import { describe, it, expect } from 'vitest';
import { JSONPath } from '../src/services/executors/jsonPath';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('JSONPath executor', () => {
  const createMockContext = (incomingInput: any, jsonPath?: string) => {
    return {
      node: {
        id: 'node-1',
        type: 'JSONPath',
        data: {
          jsonPath: jsonPath !== undefined ? jsonPath : '$.store.book[0].title',
        },
      },
      incomingInput,
    } as NodeExecutionContext;
  };

  it('should extract nested property using dot notation', () => {
    const input = {
      user: {
        profile: {
          name: 'Alice',
        },
      },
    };
    const context = createMockContext(input, '$.user.profile.name');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBe('Alice');
    expect(result.log).toBe("Extracting path '$.user.profile.name' from input");
    expect(result.tokensUsed).toBe(0);
  });

  it('should extract array items using bracket notation and integer index', () => {
    const input = {
      items: [{ name: 'Item 1' }, { name: 'Item 2' }],
    };
    const context = createMockContext(input, '$.items[1].name');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBe('Item 2');
  });

  it('should handle bracket notation with string keys', () => {
    const input = {
      data: {
        'special-key': 'value123',
      },
    };
    const context = createMockContext(input, "$['data']['special-key']");
    const result = JSONPath(context);

    expect(result.nodeOutput).toBe('value123');
  });

  it('should parse valid stringified JSON input before evaluation', () => {
    const jsonString = JSON.stringify({
      store: {
        name: 'TechShop',
      },
    });
    const context = createMockContext(jsonString, '$.store.name');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBe('TechShop');
  });

  it('should keep invalid JSON string input as string and gracefully return undefined when accessing property', () => {
    const invalidJsonString = '{ invalid json string }';
    const context = createMockContext(invalidJsonString, '$.store.name');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBeUndefined();
  });

  it('should return undefined when path does not exist in the object', () => {
    const input = { a: { b: 1 } };
    const context = createMockContext(input, '$.a.nonexistent.c');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBeUndefined();
  });

  it('should return undefined when traversing into null or undefined properties', () => {
    const input = { a: null };
    const context = createMockContext(input, '$.a.b');
    const result = JSONPath(context);

    expect(result.nodeOutput).toBeUndefined();
  });

  it('should return full input object when path is empty or only "$"', () => {
    const input = { name: 'Bob', age: 30 };

    const contextRoot = createMockContext(input, '$');
    const resultRoot = JSONPath(contextRoot);
    expect(resultRoot.nodeOutput).toEqual(input);

    const contextEmpty = createMockContext(input, '');
    const resultEmpty = JSONPath(contextEmpty);
    expect(resultEmpty.nodeOutput).toEqual(input);
  });

  it('should handle missing jsonPath property in node data gracefully', () => {
    const input = { name: 'Charlie' };
    const context = {
      node: {
        id: 'node-1',
        type: 'JSONPath',
        data: {},
      },
      incomingInput: input,
    } as NodeExecutionContext;

    const result = JSONPath(context);
    expect(result.nodeOutput).toEqual(input);
    expect(result.log).toBe("Extracting path '' from input");
  });

  it('should prevent prototype pollution when querying __proto__ or constructor', () => {
    const input = JSON.parse('{"a": 1}');
    const contextProto = createMockContext(input, '$.__proto__');
    const resultProto = JSONPath(contextProto);

    expect(resultProto.nodeOutput).toBeUndefined();

    const contextConstructor = createMockContext(input, '$.constructor');
    const resultConstructor = JSONPath(contextConstructor);

    expect(resultConstructor.nodeOutput).toBeUndefined();
  });
});
