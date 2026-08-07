import { describe, it, expect } from 'vitest';
import { cloneEdges } from '../src/store/graphStoreHelpers';
import type { Edge } from '../src/types';

describe('graphStoreHelpers', () => {
  describe('cloneEdges', () => {
    it('should clone an array of edges', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2', sourcePort: 'out1', targetPort: 'in1' },
        { id: 'e2', source: 'n2', target: 'n3' }
      ];

      const cloned = cloneEdges(edges);

      // Should have the same content
      expect(cloned).toEqual(edges);

      // Array reference should be different
      expect(cloned).not.toBe(edges);

      // Object references should be different
      expect(cloned[0]).not.toBe(edges[0]);
      expect(cloned[1]).not.toBe(edges[1]);
    });

    it('should return an empty array when given an empty array', () => {
      const edges: Edge[] = [];
      const cloned = cloneEdges(edges);

      expect(cloned).toEqual([]);
      expect(cloned).not.toBe(edges);
    });

    it('modifying cloned edge should not affect original edge', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2' }
      ];

      const cloned = cloneEdges(edges);

      cloned[0].source = 'n3';
      cloned[0].targetPort = 'in2';

      expect(edges[0].source).toBe('n1');
      expect(edges[0].targetPort).toBeUndefined();
    });
  });
});
