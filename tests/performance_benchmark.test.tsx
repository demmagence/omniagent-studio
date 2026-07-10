import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Canvas } from '../src/components/Canvas';
import { graphStore } from '../src/store/graphStore';

describe('Canvas Performance Benchmark', () => {
  it('measures render time with 500 nodes and 2000 edges', () => {
    const numNodes = 500;
    const numEdges = 2000;

    const nodes = Array.from({ length: numNodes }).map((_, i) => ({
      id: `node_${i}`,
      type: 'LLM' as const,
      position: { x: i * 10, y: i * 10 },
      data: { label: `Node ${i}`, type: 'LLM' as const }
    }));

    const edges = Array.from({ length: numEdges }).map((_, i) => ({
      id: `edge_${i}`,
      source: `node_${Math.floor(Math.random() * numNodes)}`,
      target: `node_${Math.floor(Math.random() * numNodes)}`
    }));

    graphStore.setGraph(nodes, edges);

    const start = performance.now();
    render(<Canvas />);
    const end = performance.now();

    console.log(`Canvas render time for ${numNodes} nodes and ${numEdges} edges: ${end - start} ms`);
    expect(end - start).toBeGreaterThan(0);
  }, 60000); // 60 seconds timeout
});
