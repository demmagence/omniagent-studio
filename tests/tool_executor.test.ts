import { describe, it, expect } from 'vitest';
import { Tool } from '../src/services/executors/tool';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('Tool executor', () => {
  it('should fallback to calculator if toolName is missing', () => {
    const context = {
      node: { data: {} },
      incomingInput: '5 and 10',
    } as any as NodeExecutionContext;

    const result = Tool(context);
    expect(result.nodeOutput).toBe('Result: 15');
    expect(result.log).toBe('Executing tool: calculator');
  });

  describe('calculator tool', () => {
    it('should correctly sum numbers from valid string input', () => {
      const context = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: 'add 10 and 20',
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('Result: 30');
    });

    it('should ignore "Response to:" prefix and sum numbers after it', () => {
      const context = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: 'Response to: I have 2 apples and 3 oranges',
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('Result: 5');
    });

    it('should fall back to length measurement if less than 2 numbers are present', () => {
      const context = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: 'only 1 number',
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('Processed: Length = 13');
    });

    it('should handle non-string input (number)', () => {
      const context = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: 123,
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('Processed: Length = 3');
    });

    it('should handle non-string input (null/undefined)', () => {
      const context1 = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: null,
      } as any as NodeExecutionContext;
      const result1 = Tool(context1);
      // String(null || '') is String('') which is '' -> length 0
      expect(result1.nodeOutput).toBe('Processed: Length = 0');

      const context2 = {
        node: { data: { toolName: 'calculator' } },
        incomingInput: undefined,
      } as any as NodeExecutionContext;
      const result2 = Tool(context2);
      expect(result2.nodeOutput).toBe('Processed: Length = 0');
    });
  });

  describe('webSearch tool', () => {
    it('should return correctly formatted search result string', () => {
      const context = {
        node: { data: { toolName: 'webSearch' } },
        incomingInput: 'react testing',
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('[Web Search results for: "react testing"] Found AI agent documents.');
      expect(result.log).toBe('Executing tool: webSearch');
    });
  });

  describe('unknown/fallback tool', () => {
    it('should return default success message with stringified input', () => {
      const context = {
        node: { data: { toolName: 'customTool' } },
        incomingInput: { a: 1 },
      } as any as NodeExecutionContext;

      const result = Tool(context);
      expect(result.nodeOutput).toBe('Tool customTool executed successfully with inputs: {"a":1}');
      expect(result.log).toBe('Executing tool: customTool');
    });
  });
});
