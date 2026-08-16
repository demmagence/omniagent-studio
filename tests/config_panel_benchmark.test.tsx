import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfigPanel } from '../src/components/ConfigPanel';
import { graphStore } from '../src/store/graphStore';

describe('ConfigPanel Performance Benchmark', () => {
  it('measures render time with 10000 nodes', () => {
    const numNodes = 10000;

    const nodes = Array.from({ length: numNodes }).map((_, i) => ({
      id: `node_${i}`,
      type: 'LLM' as const,
      position: { x: i * 10, y: i * 10 },
      data: { label: `Node ${i}`, type: 'LLM' as const }
    }));

    graphStore.setGraph(nodes, []);
    graphStore.selectNode(`node_${numNodes - 1}`); // Select the last node to make `find` slow

    const start = performance.now();
    for (let i = 0; i < 100; i++) { // Render multiple times to get a measurable difference
        const { unmount } = render(<ConfigPanel />);
        unmount();
    }
    const end = performance.now();

    console.log(`ConfigPanel render time for 100 renders with ${numNodes} nodes: ${end - start} ms`);
    expect(end - start).toBeGreaterThan(0);
  });
});
