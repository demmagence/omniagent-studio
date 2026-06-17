import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { deserializeGraph } from '../src/utils/graphUtils';
import { executeWorkflow } from '../src/services/executor';
import { callLLM } from '../src/services/api';
import { hasCycle, getTopologicalOrder } from '../src/utils/graphUtils';

describe('Tier 2: Boundary & Edge Cases', () => {
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
    // Directly add cyclical edge (the UI connection check is bypassed here by mock adding or by using setGraph)
    const cycleEdge = { id: 'cycle', source: n2.id, target: n1.id };
    graphStore.setGraph(graphStore.getState().nodes, [...graphStore.getState().edges, cycleEdge]);

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow(/circular dependencies/);
  });

  it('executor updates steps to failed on cycle detection', async () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    graphStore.addEdge(n1.id, n2.id);
    const cycleEdge = { id: 'cycle', source: n2.id, target: n1.id };
    graphStore.setGraph(graphStore.getState().nodes, [...graphStore.getState().edges, cycleEdge]);

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

  it('getTopologicalOrder lists all nodes in disconnected graph', () => {
    const nodes = [
      { id: 'A', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'LLM' as const } },
      { id: 'B', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'B', type: 'LLM' as const } }
    ];
    const order = getTopologicalOrder(nodes, []);
    expect(order).toContain('A');
    expect(order).toContain('B');
    expect(order.length).toBe(2);
  });

  // Timeout
  it('executor throws error on timeout', async () => {
    graphStore.addNode('LLM');
    // Force a micro-second timeout to cause a timeout failure
    await expect(executeWorkflow({ timeoutMs: 1, fallback: true })).rejects.toThrow(/timed out/);
  });

  it('executor marks unfinished nodes as failed on timeout', async () => {
    graphStore.addNode('LLM');
    try {
      await executeWorkflow({ timeoutMs: 1, fallback: true });
    } catch {
      // Ignored
    }
    const steps = graphStore.getState().traceSteps;
    expect(steps[0].status).toBe('failed');
    expect(steps[0].log).toContain('timed out');
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

  it('getTopologicalOrder returns nodes in correct sequence', () => {
    const nodes = [
      { id: 'A', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'LLM' as const } },
      { id: 'B', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'B', type: 'LLM' as const } },
      { id: 'C', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'C', type: 'LLM' as const } }
    ];
    const edges = [
      { id: 'e1', source: 'C', target: 'A' },
      { id: 'e2', source: 'A', target: 'B' }
    ];
    const order = getTopologicalOrder(nodes, edges);
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('A'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
  });

  it('getTopologicalOrder returns nodes in branching and joining graphs', () => {
    const nodes = [
      { id: 'A', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'LLM' as const } },
      { id: 'B', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'B', type: 'LLM' as const } },
      { id: 'C', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'C', type: 'LLM' as const } },
      { id: 'D', type: 'LLM' as const, position: { x: 0, y: 0 }, data: { label: 'D', type: 'LLM' as const } }
    ];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'D' }
    ];
    const order = getTopologicalOrder(nodes, edges);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
  });
});
