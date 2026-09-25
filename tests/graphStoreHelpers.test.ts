import { describe, it, expect } from 'vitest';
import { cloneNodes, cloneEdges, cloneTraceSteps } from '../src/store/graphStoreHelpers';
import { Node, Edge, TraceStep } from '../src/types';

describe('graphStoreHelpers', () => {
  describe('cloneNodes', () => {
    it('should clone nodes and remove apiKey from data', () => {
      const inputNodes: Node[] = [
        {
          id: 'node1',
          type: 'LLM',
          position: { x: 100, y: 200 },
          data: {
            label: 'Test Node',
            type: 'LLM',
            apiKey: 'secret-123',
            model: 'gpt-4',
          },
        },
      ];

      const clonedNodes = cloneNodes(inputNodes);

      expect(clonedNodes).toHaveLength(1);
      expect(clonedNodes[0]).not.toBe(inputNodes[0]); // Ensure it's a new object
      expect(clonedNodes[0].position).not.toBe(inputNodes[0].position); // Ensure deep clone for position

      expect(clonedNodes[0].id).toBe('node1');
      expect(clonedNodes[0].type).toBe('LLM');
      expect(clonedNodes[0].position).toEqual({ x: 100, y: 200 });

      // Ensure apiKey is removed but other data remains
      expect(clonedNodes[0].data).toEqual({
        label: 'Test Node',
        type: 'LLM',
        model: 'gpt-4',
      });
      expect('apiKey' in clonedNodes[0].data).toBe(false);
    });

    it('should handle nodes without apiKey safely', () => {
      const inputNodes: Node[] = [
        {
          id: 'node2',
          type: 'Prompt',
          position: { x: 0, y: 0 },
          data: {
            label: 'Prompt Node',
            type: 'Prompt',
            promptTemplate: 'Hello',
          },
        },
      ];

      const clonedNodes = cloneNodes(inputNodes);

      expect(clonedNodes[0].data).toEqual({
        label: 'Prompt Node',
        type: 'Prompt',
        promptTemplate: 'Hello',
      });
    });

    it('should handle empty array', () => {
      expect(cloneNodes([])).toEqual([]);
    });
  });

  describe('cloneEdges', () => {
    it('should clone edges', () => {
      const inputEdges: Edge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          sourcePort: 'out',
          targetPort: 'in',
        },
      ];

      const clonedEdges = cloneEdges(inputEdges);

      expect(clonedEdges).toHaveLength(1);
      expect(clonedEdges[0]).not.toBe(inputEdges[0]); // Ensure it's a new object
      expect(clonedEdges[0]).toEqual(inputEdges[0]);
    });

    it('should handle empty array', () => {
      expect(cloneEdges([])).toEqual([]);
    });
  });

  describe('cloneTraceSteps', () => {
    it('should clone trace steps and deeply clone input/output', () => {
      const inputSteps: TraceStep[] = [
        {
          nodeId: 'n1',
          status: 'completed',
          input: { text: 'hi', obj: { val: 1 } },
          output: { text: 'hello', arr: [1, 2, 3] },
          log: 'Execution finished successfully',
          tokensConsumed: 150,
        },
      ];

      const clonedSteps = cloneTraceSteps(inputSteps);

      expect(clonedSteps).toHaveLength(1);
      expect(clonedSteps[0]).not.toBe(inputSteps[0]); // Ensure it's a new object

      expect(clonedSteps[0].input).toEqual(inputSteps[0].input);
      expect(clonedSteps[0].input).not.toBe(inputSteps[0].input); // Ensure deep clone

      expect(clonedSteps[0].output).toEqual(inputSteps[0].output);
      expect(clonedSteps[0].output).not.toBe(inputSteps[0].output); // Ensure deep clone

      expect(clonedSteps[0].log).toBe('Execution finished successfully');
      expect(clonedSteps[0].tokensConsumed).toBe(150);
    });

    it('should prevent object mutation between clone and original input/output', () => {
      const originalInput = { nested: { count: 10 }, items: ['a', 'b'] };
      const originalOutput = { result: { ok: true } };

      const inputSteps: TraceStep[] = [
        {
          nodeId: 'n1',
          status: 'completed',
          input: originalInput,
          output: originalOutput,
        },
      ];

      const clonedSteps = cloneTraceSteps(inputSteps);

      // Mutate cloned step nested input and output
      (clonedSteps[0].input as { nested: { count: number }; items: string[] }).nested.count = 999;
      (clonedSteps[0].input as { nested: { count: number }; items: string[] }).items.push('c');
      (clonedSteps[0].output as { result: { ok: boolean } }).result.ok = false;

      // Verify original objects are unchanged
      expect(originalInput.nested.count).toBe(10);
      expect(originalInput.items).toEqual(['a', 'b']);
      expect(originalOutput.result.ok).toBe(true);
    });

    it('should handle trace steps without input/output (undefined)', () => {
      const inputSteps: TraceStep[] = [
        {
          nodeId: 'n2',
          status: 'running',
          input: undefined,
          output: undefined,
        },
      ];

      const clonedSteps = cloneTraceSteps(inputSteps);

      expect(clonedSteps[0]).toEqual(inputSteps[0]);
      expect(clonedSteps[0].input).toBeUndefined();
      expect(clonedSteps[0].output).toBeUndefined();
    });

    it('should handle trace steps with null input/output', () => {
      const inputSteps: TraceStep[] = [
        {
          nodeId: 'n3',
          status: 'failed',
          input: null,
          output: null,
        } as unknown as TraceStep,
      ];

      const clonedSteps = cloneTraceSteps(inputSteps);

      expect(clonedSteps[0].input).toBeNull();
      expect(clonedSteps[0].output).toBeNull();
    });

    it('should handle primitive types in input and output', () => {
      const inputSteps: TraceStep[] = [
        {
          nodeId: 'n4',
          status: 'completed',
          input: 'primitive string',
          output: 42,
        },
      ];

      const clonedSteps = cloneTraceSteps(inputSteps);

      expect(clonedSteps[0].input).toBe('primitive string');
      expect(clonedSteps[0].output).toBe(42);
    });

    it('should handle empty array', () => {
      expect(cloneTraceSteps([])).toEqual([]);
    });
  });
});
