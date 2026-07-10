import { describe, it, expect } from 'vitest';
import { serializeGraph, autoLayout, deserializeGraph } from '../src/utils/graphUtils';
import { Node, Edge } from '../src/types';

describe('serializeGraph', () => {
  it('should redact apiKey from node data', () => {
    const nodes: Node[] = [
      {
        id: 'node_1',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: {
          label: 'LLM Node',
          type: 'LLM',
          apiKey: 'super_secret_key',
          model: 'gpt-4o-mini',
        },
      },
    ];
    const edges: Edge[] = [];

    const jsonStr = serializeGraph(nodes, edges);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.nodes[0].data.apiKey).toBeUndefined();
    expect(parsed.nodes[0].data.model).toBe('gpt-4o-mini');
  });

  it('should keep other properties intact', () => {
    const nodes: Node[] = [
      {
        id: 'node_2',
        type: 'Prompt',
        position: { x: 10, y: 10 },
        data: {
          label: 'Prompt Node',
          type: 'Prompt',
          promptTemplate: 'Hello {world}',
        },
      },
    ];
    const edges: Edge[] = [
      {
        id: 'edge_1',
        source: 'node_1',
        target: 'node_2',
      }
    ];

    const jsonStr = serializeGraph(nodes, edges);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.nodes[0].data.promptTemplate).toBe('Hello {world}');
    expect(parsed.edges[0].id).toBe('edge_1');
  });
});

// Helper to create a basic node
const createNode = (id: string): Node => ({
  id,
  type: 'LLM',
  position: { x: 0, y: 0 },
  data: { label: id, type: 'LLM' }
});

// Helper to create a basic edge
const createEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target
});

describe('autoLayout', () => {
  it('should return an empty map when nodes array is empty', () => {
    const result = autoLayout([], []);
    expect(result.size).toBe(0);
  });

  it('should place a single node at default start positions', () => {
    const nodes = [createNode('A')];
    const result = autoLayout(nodes, []);

    expect(result.get('A')).toEqual({ x: 80, y: 60 });
  });

  it('should layout a simple chain A -> B -> C', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')];
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')];

    const result = autoLayout(nodes, edges);

    // Default layerGap is 280, startX is 80, startY is 60
    expect(result.get('A')).toEqual({ x: 80, y: 60 });
    expect(result.get('B')).toEqual({ x: 80 + 280, y: 60 });
    expect(result.get('C')).toEqual({ x: 80 + 280 * 2, y: 60 });
  });

  it('should layout a complex DAG with branching and merging', () => {
    // A -> B, A -> C, B -> D, C -> D
    const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')];
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D')
    ];

    const result = autoLayout(nodes, edges);

    // Layer 0: A
    expect(result.get('A')).toEqual({ x: 80, y: 60 });

    // Layer 1: B, C
    // totalHeight = (2 - 1) * 160 = 160
    // offsetY = 60 - 160 / 2 = -20
    // y0 = max(20, -20 + 0 * 160) = max(20, -20) = 20
    // y1 = max(20, -20 + 1 * 160) = max(20, 140) = 140
    expect(result.get('B')).toEqual({ x: 80 + 280, y: 20 });
    expect(result.get('C')).toEqual({ x: 80 + 280, y: 140 });

    // Layer 2: D
    expect(result.get('D')).toEqual({ x: 80 + 280 * 2, y: 60 });
  });

  it('should respect custom options', () => {
    const nodes = [createNode('A'), createNode('B')];
    const edges = [createEdge('A', 'B')];

    const options = { startX: 100, startY: 100, layerGap: 200, nodeGap: 100 };
    const result = autoLayout(nodes, edges, options);

    expect(result.get('A')).toEqual({ x: 100, y: 100 });
    expect(result.get('B')).toEqual({ x: 300, y: 100 });
  });

  it('should place disconnected nodes in layer 0', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')];
    const result = autoLayout(nodes, []);

    // All in layer 0
    // totalHeight = 2 * 160 = 320
    // offsetY = 60 - 160 = -100
    // y0 = max(20, -100) = 20
    // y1 = max(20, -100 + 160) = max(20, 60) = 60
    // y2 = max(20, -100 + 320) = max(20, 220) = 220

    expect(result.get('A')).toEqual({ x: 80, y: 20 });
    expect(result.get('B')).toEqual({ x: 80, y: 60 });
    expect(result.get('C')).toEqual({ x: 80, y: 220 });
  });
});

describe('deserializeGraph', () => {
  it('should throw an error if nodes is not an array', () => {
    const jsonStr = JSON.stringify({ nodes: 'not an array', edges: [] });
    expect(() => deserializeGraph(jsonStr)).toThrow('Failed to deserialize graph: nodes must be an array');
  });

  it('should throw an error if edges is not an array', () => {
    const jsonStr = JSON.stringify({ nodes: [], edges: 'not an array' });
    expect(() => deserializeGraph(jsonStr)).toThrow('Failed to deserialize graph: edges must be an array');
  });
});
