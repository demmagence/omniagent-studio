import { describe, it, expect } from 'vitest';
import { serializeGraph } from '../src/utils/graphUtils';
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
