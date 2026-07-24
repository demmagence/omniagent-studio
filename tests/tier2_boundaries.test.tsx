import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';
import * as api from '../src/services/api';
import { callLLM } from '../src/services/api';
import { deserializeGraph, hasCycle } from '../src/utils/graphUtils';

describe('Tier 2: Boundary & Edge Cases', () => {
  it('handles executeNode rejection gracefully and updates trace steps', async () => {
    graphStore.resetGraph();
    const n1 = graphStore.addNode('Prompt');
    const n2 = graphStore.addNode('LLM');
    graphStore.addEdge(n1.id, n2.id);

    // Make n1 invalid so it throws
    const state = graphStore.getState();
    const invalidNode = { ...state.nodes[0], type: 'InvalidType' as any };
    graphStore.setGraph([invalidNode, state.nodes[1]], state.edges);

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Unknown node type: InvalidType');

    const steps = graphStore.getState().traceSteps;
    expect(steps.find(s => s.nodeId === n1.id)?.status).toBe('failed');
    expect(steps.find(s => s.nodeId === n1.id)?.log).toContain('Error executing node: Unknown node type');
    expect(steps.find(s => s.nodeId === n2.id)?.status).toBe('failed');
    expect(steps.find(s => s.nodeId === n2.id)?.log).toContain('Aborted: Unknown node type');
  });

  const addEdgeUnsafeForTest = (source: string, target: string, id = 'cycle') => {
    const unsafeEdge = { id, source, target };
    const state = graphStore.getState();
    graphStore.setGraph(state.nodes, [...state.edges, unsafeEdge]);
  };

  beforeEach(() => {
    graphStore.resetGraph();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Empty fields
  it('Prompt node executes with empty template', async () => {
    const p = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p.id, { promptTemplate: '' });
    const steps = await executeWorkflow({ fallback: true });
    const step = steps.find(s => s.nodeId === p.id);
    expect(step?.output).toBe('');
  });

  it('LLM node executes with empty prompt when disconnected', async () => {
    const l = graphStore.addNode('LLM');
    const steps = await executeWorkflow({ fallback: true });
    const step = steps.find(s => s.nodeId === l.id);
    expect(step?.input).toBe('Default Prompt');
  });

  it('Tool node executes with empty toolName (defaults to calculator)', async () => {
    const t = graphStore.addNode('Tool');
    graphStore.updateNodeData(t.id, { toolName: '' });
    const steps = await executeWorkflow({ fallback: true });
    const step = steps.find(s => s.nodeId === t.id);
    expect(step?.log).toContain('Executing tool: calculator');
  });

  it('Router node executes with empty rules (defaults to Default Route)', async () => {
    const r = graphStore.addNode('Router');
    graphStore.updateNodeData(r.id, { routingRules: '' });
    const steps = await executeWorkflow({ fallback: true });
    const step = steps.find(s => s.nodeId === r.id);
    expect(step?.output).toBe('Default Route');
  });

  it('Output node executes with no incoming edges', async () => {
    const o = graphStore.addNode('Output');
    const steps = await executeWorkflow({ fallback: true });
    const step = steps.find(s => s.nodeId === o.id);
    expect(step?.output).toBeNull();
  });

  // Invalid inputs
  it('LLM provider set to unknown string throws error', async () => {
    const l = graphStore.addNode('LLM');
    graphStore.updateNodeData(l.id, { provider: 'unknown_provider' as any });
    await expect(executeWorkflow({ fallback: false })).rejects.toThrow();
  });

  it('JSON deserialize with invalid format throws Error', () => {
    expect(() => deserializeGraph('not a json')).toThrow('Failed to deserialize graph');
  });

  it('JSON deserialize with non-object throws Error', () => {
    expect(() => deserializeGraph('"just a string"')).toThrow('Invalid graph data format');
  });

  it('JSON deserialize with missing nodes/edges handles gracefully', () => {
    const result = deserializeGraph('{}');
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('JSON deserialize with non-array nodes throws Error', () => {
    expect(() => deserializeGraph('{"nodes": "not an array"}')).toThrow('Failed to deserialize graph: nodes must be an array');
  });

  it('JSON deserialize with non-array edges throws Error', () => {
    expect(() => deserializeGraph('{"edges": "not an array"}')).toThrow('Failed to deserialize graph: edges must be an array');
  });

  // Circular graphs
  it('hasCycle returns true on circular node connections', () => {
    const n1 = { id: 'A', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'LLM' as const } };
    const n2 = { id: 'B', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'B', type: 'LLM' as const } };
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'A' }
    ];
    expect(hasCycle([n1, n2], edges)).toBe(true);
  });

  it('hasCycle returns false on linear graph', () => {
    const n1 = { id: 'A', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'LLM' as const } };
    const n2 = { id: 'B', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'B', type: 'LLM' as const } };
    const edges = [
      { id: 'e1', source: 'A', target: 'B' }
    ];
    expect(hasCycle([n1, n2], edges)).toBe(false);
  });

  it('hasCycle returns false on empty graph', () => {
    expect(hasCycle([], [])).toBe(false);
  });

  it('executor throws error when circular graph is run', async () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    graphStore.addEdge(n1.id, n2.id);
    // Intentionally bypass normal edge validation to construct an invalid cyclic graph for this boundary test.
    addEdgeUnsafeForTest(n2.id, n1.id, 'cycle');

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow(/circular dependencies/);
  });

  it('executor updates steps to failed on cycle detection', async () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    graphStore.addEdge(n1.id, n2.id);
    addEdgeUnsafeForTest(n2.id, n1.id, 'cycle');

    try {
      await executeWorkflow({ fallback: true });
    } catch {
      // Ignored, check state
    }
    const steps = graphStore.getState().traceSteps;
    expect(steps.every(s => s.status === 'failed')).toBe(true);
  });

  // Disconnected graphs
  it('executor runs all nodes in disconnected graphs', async () => {
    graphStore.addNode('LLM');
    graphStore.addNode('Prompt');
    const steps = await executeWorkflow({ fallback: true });
    expect(steps.length).toBe(2);
    expect(steps.every(s => s.status === 'completed')).toBe(true);
  });

  // Timeout
  it('executor throws error on timeout', async () => {
    graphStore.addNode('LLM');
    vi.spyOn(api, 'callLLM').mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)) as never);
    vi.useFakeTimers();
    try {
      const run = executeWorkflow({ timeoutMs: 3, fallback: true });
      const check = expect(run).rejects.toThrow(/timed out/);
      await vi.advanceTimersByTimeAsync(4);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });

  it('executor marks unfinished nodes as failed on timeout', async () => {
    graphStore.addNode('LLM');
    vi.spyOn(api, 'callLLM').mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)) as never);
    vi.useFakeTimers();
    try {
      const run = executeWorkflow({ timeoutMs: 3, fallback: true });
      const silentRun = run.catch(() => {});
      await vi.advanceTimersByTimeAsync(4);
      await silentRun;
      const steps = graphStore.getState().traceSteps;
      expect(steps[0].status).toBe('failed');
      expect(steps[0].log).toMatch(/workflow execution timed out|timed out/);
    } finally {
      vi.useRealTimers();
    }
  });

  // API Call Errors
  it('OpenAI fetch returns non-ok status throws error', async () => {
    // Stub fetch to return 401
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized API Key'
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(callLLM('openai', 'gpt-4', 'hello', { apiKey: 'bad-key', fallback: false }))
      .rejects.toThrow(/OpenAI API failed with status 401/);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('openai'),
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('Ollama fetch returns non-ok status throws error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Model not found'
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(callLLM('ollama', 'llama-bad', 'hello', { fallback: false }))
      .rejects.toThrow(/Ollama API failed with status 500/);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object)
    );
  });

  it('window.fetch throws network block error when fallback is false', async () => {
    // Rely on setup.ts intercept
    await expect(callLLM('openai', 'gpt-4', 'hello', { fallback: false }))
      .rejects.toThrow(/External network call blocked/);
  });

  // Stress logs & structures
  it('node outputs huge log string correctly', async () => {
    const p = graphStore.addNode('Prompt');
    const hugeText = 'A'.repeat(50000);
    graphStore.updateNodeData(p.id, { promptTemplate: hugeText });
    const steps = await executeWorkflow({ fallback: true });
    expect(steps[0].output).toBe(hugeText);
  });

  it('node input/output with complex structure handles gracefully', async () => {
    const p = graphStore.addNode('Prompt');
    const t = graphStore.addNode('Tool');
    graphStore.addEdge(p.id, t.id);

    // Let's set prompt to evaluate to a JSON string representation
    graphStore.updateNodeData(p.id, { promptTemplate: '{"query": "AI research", "limit": 10}' });
    graphStore.updateNodeData(t.id, { toolName: 'webSearch' });

    const steps = await executeWorkflow({ fallback: true });
    const toolStep = steps.find(s => s.nodeId === t.id);
    expect(toolStep?.input).toContain('{"query": "AI research", "limit": 10}');
    expect(toolStep?.output).toContain('Found AI agent documents.');
  });

  it('runs execution with 50 nodes and 49 edges', async () => {
    const nodes = [];
    const edges = [];
    for (let i = 0; i < 50; i++) {
      const type = i === 49 ? 'Output' : (i % 2 === 0 ? 'Prompt' : 'LLM');
      const node = {
        id: `node_${i}`,
        type: type as any,
        position: { x: i * 10, y: i * 10 },
        data: { label: `Node ${i}`, type: type as any, promptTemplate: `Prompt_${i}` }
      };
      nodes.push(node);
      if (i > 0) {
        edges.push({
          id: `edge_${i-1}_${i}`,
          source: `node_${i-1}`,
          target: `node_${i}`
        });
      }
    }
    graphStore.setGraph(nodes, edges);
    const steps = await executeWorkflow({ fallback: true });
    expect(steps.length).toBe(50);
    expect(steps.every(s => s.status === 'completed')).toBe(true);
  });

  // Duplicate edges & self connections
  it('store rejects adding duplicate edge', () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    const edge1 = graphStore.addEdge(n1.id, n2.id);
    const edge2 = graphStore.addEdge(n1.id, n2.id);

    expect(edge1).not.toBeNull();
    expect(edge2).toBeNull();
    expect(graphStore.getState().edges.length).toBe(1);
  });

  it('store rejects adding self connection edge', () => {
    const n = graphStore.addNode('LLM');
    const edge = graphStore.addEdge(n.id, n.id);
    expect(edge).toBeNull();
    expect(graphStore.getState().edges.length).toBe(0);
  });


  it('JSONPath node handles malformed JSON string gracefully', async () => {
    const p = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p.id, { promptTemplate: '{"invalid": "json"' });

    const j = graphStore.addNode('JSONPath');
    graphStore.updateNodeData(j.id, { jsonPath: '' });

    graphStore.addEdge(p.id, j.id);

    const steps = await executeWorkflow({ fallback: true });

    const jsonPathStep = steps.find(s => s.nodeId === j.id);
    expect(jsonPathStep).toBeDefined();
    expect(jsonPathStep?.status).toBe('completed');
    expect(jsonPathStep?.input).toBe('{"invalid": "json"');
    expect(jsonPathStep?.output).toBe('{"invalid": "json"');
  });

});
