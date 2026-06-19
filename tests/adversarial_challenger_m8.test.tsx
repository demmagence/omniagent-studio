import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Milestone 8: Adversarial & Stress Testing', () => {
  const DEFAULT_MOCK_DELAY_MS = 10;
  const FAST_NODE_DELAY_MS = DEFAULT_MOCK_DELAY_MS;
  const SLOW_NODE_DELAY_MS = 50;

  let unsafeEdgeCounter = 0;
  const addEdgeUnsafeForTest = (source: string, target: string, id?: string) => {
    unsafeEdgeCounter += 1;
    const resolvedId = id ?? `cycle_${unsafeEdgeCounter}`;
    const unsafeEdge = { id: resolvedId, source, target };
    const state = graphStore.getState();
    graphStore.setGraph(state.nodes, [...state.edges, unsafeEdge]);
  };

  const createMockFetch = ({
    onStart,
    onFinish,
    content = 'parallel-result',
    totalTokens = 5,
    delayMs = DEFAULT_MOCK_DELAY_MS
  }: {
    onStart?: () => void;
    onFinish?: () => void;
    content?: string;
    totalTokens?: number;
    delayMs?: number;
  }) => {
    return vi.fn().mockImplementation(() => {
      onStart?.();
      return new Promise((resolve) => {
        setTimeout(() => {
          onFinish?.();
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content } }],
              usage: { total_tokens: totalTokens }
            })
          });
        }, delayMs);
      });
    });
  };

  beforeEach(() => {
    unsafeEdgeCounter = 0;
    graphStore.resetGraph();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ==========================================
  // 1. CYCLE HANDLING ADVERSARIAL CASES
  // ==========================================
  
  it('handles nested/multiple cycles and immediately aborts execution', async () => {
    // A -> B -> C -> A (Cycle 1)
    // B -> D -> E -> B (Cycle 2)
    const nA = graphStore.addNode('Prompt');
    const nB = graphStore.addNode('LLM');
    const nC = graphStore.addNode('Tool');
    const nD = graphStore.addNode('Router');
    const nE = graphStore.addNode('Output');

    graphStore.addEdge(nA.id, nB.id);
    graphStore.addEdge(nB.id, nC.id);
    addEdgeUnsafeForTest(nC.id, nA.id); // Cycle 1

    graphStore.addEdge(nB.id, nD.id);
    graphStore.addEdge(nD.id, nE.id);
    addEdgeUnsafeForTest(nE.id, nB.id); // Cycle 2

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Workflow contains circular dependencies / cycles.');
    
    const steps = graphStore.getState().traceSteps;
    const expectedStepCount = [nA, nB, nC, nD, nE].length;
    expect(steps.length).toBe(expectedStepCount);
    expect(steps.every(s => s.status === 'failed')).toBe(true);
    expect(steps.some(s => s.status === 'completed')).toBe(false);
    expect(steps.every(s => s.log?.includes('Cycle detected in graph'))).toBe(true);
  });

  it('handles a cycle in one disconnected component while another is clean', async () => {
    // Component 1: nA -> nB -> nA (Cycle)
    // Component 2: nC -> nD (Clean)
    const nA = graphStore.addNode('Prompt');
    const nB = graphStore.addNode('LLM');
    graphStore.addEdge(nA.id, nB.id);
    addEdgeUnsafeForTest(nB.id, nA.id);

    const nC = graphStore.addNode('Prompt');
    const nD = graphStore.addNode('Output');
    graphStore.addEdge(nC.id, nD.id);

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Workflow contains circular dependencies / cycles.');

    const steps = graphStore.getState().traceSteps;
    const expectedStepCount = [nA, nB, nC, nD].length;
    expect(steps.length).toBe(expectedStepCount);
    expect(steps.every(s => s.status === 'failed')).toBe(true);
  });

  // ==========================================
  // 2. TIMEOUT SCENARIOS & ABORT PROPAGATION
  // ==========================================

  it('aborts active fetch requests and subsequent nodes on timeout', async () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    graphStore.addEdge(n1.id, n2.id);

    let fetchAborted = false;
    const EXECUTION_TIMEOUT_MS = 50;
    const FETCH_DELAY_EXCEEDING_TIMEOUT_MS = 1000;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const signal =
        init && typeof init === 'object' && 'signal' in init
          ? init.signal
          : undefined;
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          fetchAborted = true;
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort);
        setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'success' } }], usage: { total_tokens: 10 } })
          });
        }, FETCH_DELAY_EXCEEDING_TIMEOUT_MS);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run with configured execution timeout
    const promise = executeWorkflow({ fallback: false, timeoutMs: EXECUTION_TIMEOUT_MS });
    await expect(promise).rejects.toThrow(/execution timed out/);

    // Verify fetch abort signal was triggered
    expect(fetchAborted).toBe(true);

    const steps = graphStore.getState().traceSteps;
    const step1 = steps.find(s => s.nodeId === n1.id);
    const step2 = steps.find(s => s.nodeId === n2.id);

    // The timed out node and any pending nodes should be failed
    expect(step1?.status).toBe('failed');
    expect(step1?.log).toContain('Aborted:');
    expect(step2?.status).toBe('failed');
    expect(step2?.log).toContain('Aborted:');
  });

  // ==========================================
  // 3. HIGH LOAD & FAN-OUT/FAN-IN
  // ==========================================

  it('runs a 52-node fan-out/fan-in workflow respecting concurrency limit', async () => {
    // Total nodes: 1 start (nStart) + 50 parallel mid nodes + 1 end (nEnd) = 52
    const nStart = graphStore.addNode('Prompt');
    graphStore.updateNodeData(nStart.id, { promptTemplate: 'Input' });

    const midNodes = [];
    const numParallel = 50;
    for (let i = 0; i < numParallel; i++) {
      const n = graphStore.addNode('LLM');
      graphStore.updateNodeData(n.id, { provider: 'openai', model: 'gpt-4o', label: `LLM Node ${i}` });
      graphStore.addEdge(nStart.id, n.id);
      midNodes.push(n);
    }

    const nEnd = graphStore.addNode('Output');
    for (const n of midNodes) {
      graphStore.addEdge(n.id, nEnd.id);
    }

    // Stub fetch to measure concurrency
    let currentConcurrency = 0;
    let maxObservedConcurrency = 0;

    const mockFetch = createMockFetch({
      onStart: () => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
      },
      onFinish: () => {
        currentConcurrency--;
      },
      content: 'parallel-result',
      totalTokens: 5,
      delayMs: DEFAULT_MOCK_DELAY_MS
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run with maxConcurrency = 5
    const steps = await executeWorkflow({ fallback: false, maxConcurrency: 5 });

    const expectedSteps = numParallel + 2; // start + end nodes
    expect(steps.length).toBe(expectedSteps);
    expect(steps.every(s => s.status === 'completed')).toBe(true);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
    expect(maxObservedConcurrency).toBe(5);

    // The output node should have received inputs from all parallel branches
    const endStep = steps.find(s => s.nodeId === nEnd.id);
    expect(endStep).toBeDefined();
    const endInput = endStep?.input;
    expect(endInput).toBeDefined();
    expect(Object.keys(endInput ?? {}).length).toBe(50);
  });

  // ==========================================
  // 4. RACE CONDITIONS & OUT-OF-ORDER RESOLUTION
  // ==========================================

  it('correctly handles nodes completing in out-of-order sequence', async () => {
    // Two independent LLM nodes
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');

    // n1 takes SLOW_NODE_DELAY_MS, n2 takes FAST_NODE_DELAY_MS
    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const rawBody = init && typeof init.body === 'string' ? init.body : null;
      const parsedBody = rawBody ? JSON.parse(rawBody) : null;
      const prompt = parsedBody?.messages?.[parsedBody.messages.length - 1]?.content ?? 'n2';
      const delay = prompt === 'n1' ? SLOW_NODE_DELAY_MS : FAST_NODE_DELAY_MS;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: `Response to ${prompt}` } }],
              usage: { total_tokens: 10 }
            })
          });
        }, delay);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const p1 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p1.id, { promptTemplate: 'n1' });
    graphStore.addEdge(p1.id, n1.id);

    const p2 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p2.id, { promptTemplate: 'n2' });
    graphStore.addEdge(p2.id, n2.id);

    await executeWorkflow({ fallback: false, maxConcurrency: 2 });

    const steps = graphStore.getState().traceSteps;
    expect(steps.every(s => s.status === 'completed')).toBe(true);

    const stepN1 = steps.find(s => s.nodeId === n1.id);
    const stepN2 = steps.find(s => s.nodeId === n2.id);

    expect(stepN1?.output).toBe('Response to n1');
    expect(stepN2?.output).toBe('Response to n2');
  });

  it('prevents state corruption and rejects when workflow is executed in replay mode', async () => {
    graphStore.addNode('Prompt');
    // Run once to add to history
    await executeWorkflow({ fallback: true });
    
    const history = graphStore.getState().history;
    expect(history.length).toBe(1);
    
    // Enter replay mode
    graphStore.selectRun(history[0].id);
    expect(graphStore.getState().selectedRunId).toBe(history[0].id);

    // Snapshot state before rejected execution attempt
    const before = graphStore.getState();
    const beforeNodes = before.nodes;
    const beforeEdges = before.edges;
    const beforeTraceSteps = before.traceSteps;
    const beforeHistoryLength = before.history.length;
    const beforeSelectedRunId = before.selectedRunId;

    // Call executeWorkflow should throw
    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Cannot execute workflow during replay');

    // Ensure state was not modified by failed execution attempt
    const after = graphStore.getState();
    expect(after.nodes).toEqual(beforeNodes);
    expect(after.edges).toEqual(beforeEdges);
    expect(after.traceSteps).toEqual(beforeTraceSteps);
    expect(after.history.length).toBe(beforeHistoryLength);
    expect(after.selectedRunId).toBe(beforeSelectedRunId);

    // Exit replay mode
    graphStore.selectRun(null);
    expect(graphStore.getState().selectedRunId).toBeNull();

    // Verify workflow can execute again after exiting replay mode
    await expect(executeWorkflow({ fallback: true })).resolves.toBeDefined();
    expect(graphStore.getState().history.length).toBe(beforeHistoryLength + 1);
  });
});
