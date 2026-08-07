import { describe, it, expect } from 'vitest';
import { cloneNodes, cloneEdges, cloneTraceSteps } from '../src/store/graphStoreHelpers';
import { Node, Edge, TraceStep } from '../src/types';

describe('graphStoreHelpers', () => {
  describe('cloneNodes', () => {
    it('should clone nodes and remove apiKey from data', () => {
      const nodes: Node[] = [
        {
          id: 'n1',
          type: 'LLM',
          position: { x: 10, y: 20 },
          data: { label: 'Node 1', type: 'LLM', apiKey: 'secret-key', model: 'gpt-4' }
        }
      ];

      const cloned = cloneNodes(nodes);

      expect(cloned).not.toBe(nodes);
      expect(cloned[0]).not.toBe(nodes[0]);
      expect(cloned[0].position).not.toBe(nodes[0].position);
      expect(cloned[0].data).not.toBe(nodes[0].data);

      expect(cloned[0].id).toBe('n1');
      expect(cloned[0].position).toEqual({ x: 10, y: 20 });
      expect(cloned[0].data.label).toBe('Node 1');
      expect(cloned[0].data.model).toBe('gpt-4');

      // Verify apiKey is removed
      expect(cloned[0].data.apiKey).toBeUndefined();
    });
  });

  describe('cloneEdges', () => {
    it('should shallow clone edges', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2', sourcePort: 'out', targetPort: 'in' }
      ];

      const cloned = cloneEdges(edges);

      expect(cloned).not.toBe(edges);
      expect(cloned[0]).not.toBe(edges[0]);

      expect(cloned[0]).toEqual(edges[0]);
    });
  });

  describe('cloneTraceSteps', () => {
    it('should return an empty array when given an empty array', () => {
      expect(cloneTraceSteps([])).toEqual([]);
    });

    it('should deep clone input and output properties', () => {
      const steps: TraceStep[] = [
        {
          nodeId: '1',
          status: 'completed',
          input: { a: 1, nested: { b: 2 } },
          output: { c: 3, arr: [1, 2] }
        }
      ];

      const cloned = cloneTraceSteps(steps);

      expect(cloned).not.toBe(steps);
      expect(cloned[0]).not.toBe(steps[0]);
      expect(cloned[0]).toEqual(steps[0]);

      // Verify deep clone by mutating the original
      const origInput = steps[0].input as any;
      origInput.nested.b = 99;

      const origOutput = steps[0].output as any;
      origOutput.arr.push(3);

      // The clone should not be affected by the mutation
      const clonedInput = cloned[0].input as any;
      expect(clonedInput.nested.b).toBe(2);

      const clonedOutput = cloned[0].output as any;
      expect(clonedOutput.arr).toEqual([1, 2]);
    });

    it('should handle undefined or null input and output', () => {
      const steps: TraceStep[] = [
        {
          nodeId: '2',
          status: 'pending',
          input: undefined,
          output: null
        }
      ];

      const cloned = cloneTraceSteps(steps);

      expect(cloned[0].input).toBeUndefined();
      expect(cloned[0].output).toBeNull();
    });

    it('should handle falsy values like 0, false, empty string correctly', () => {
      const steps: TraceStep[] = [
        {
          nodeId: '3',
          status: 'running',
          input: 0,
          output: false
        },
        {
          nodeId: '4',
          status: 'completed',
          input: '',
          output: NaN
        }
      ];

      const cloned = cloneTraceSteps(steps);

      expect(cloned[0].input).toBe(0);
      expect(cloned[0].output).toBe(false);
      expect(cloned[1].input).toBe('');
      expect(Number.isNaN(cloned[1].output)).toBe(true);
    });
  });
});
