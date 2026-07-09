import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Milestone 8: Adversarial & Stress Testing', () => {
  const DEFAULT_MOCK_DELAY_MS = 10;
  const SLOW_NODE_DELAY_MS = 50;
  // Allows minor timing jitter from event loop scheduling and test runner overhead.
  const TIMING_TOLERANCE_MS = 5;
  const FALLBACK_NODE_ID = 'n2';
  const WORKFLOW_START_NODES = 1;
  const WORKFLOW_END_NODES = 1;
  const OUT_OF_ORDER_TEST_CONCURRENCY = 2;

  const extractPromptFromRequest = (
    init?: RequestInit,
    defaultNodeId: string = FALLBACK_NODE_ID
  ): string => {
    const rawBody = init && typeof init.body === 'string' ? init.body : null;
    let parsedBody: { messages?: Array<{ content?: string }> } | null = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody) as { messages?: Array<{ content?: string }> };
      } catch {
        parsedBody = null;
      }
    }
    const messages = parsedBody?.messages;

    return Array.isArray(messages) && messages.length > 0
      ? messages[messages.length - 1]?.content ?? defaultNodeId
      : defaultNodeId;
  };

  const addEdgeWithoutCycleCheckForTest = (source: string, target: string, id?: string) => {
    const state = graphStore.getState();
    const resolvedId = id ?? `cycle_${state.edges.length + 1}`;
    const unsafeEdge = { id: resolvedId, source, target };
    graphStore.setGraph(state.nodes, [...state.edges, unsafeEdge]);
  };

  const createMockFetch = ({
    onStart,
    onFinish,
    onAbort,
    content = 'parallel-result',
    totalTokens = 5,
    delayMs = DEFAULT_MOCK_DELAY_MS,
    response
  }: {
    onStart?: () => void;
    onFinish?: () => void;
    onAbort?: () => void;
    content?: string;
    totalTokens?: number;
    delayMs?: number;
    response?: any;
  }) => {
    return vi.fn().mockImplementation((_url, init) => {
      onStart?.();
      const signal = init?.signal;
      return new Promise((resolve, reject) => {
        const _onAbort = () => {
          onAbort?.();
          signal?.removeEventListener('abort', _onAbort);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };

        if (signal?.aborted) {
          _onAbort();
          return;
        }

        signal?.addEventListener('abort', _onAbort);

        setTimeout(() => {
          onFinish?.();
          signal?.removeEventListener('abort', _onAbort);
          resolve({
            ok: true,
            status: 200,
            json: async () =>
              response ?? {
                choices: [{ message: { content } }],
                usage: { total_tokens: totalTokens }
              }
          });
        }, delayMs);
      });
    });
  };

  beforeEach(() => {
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
    addEdgeWithoutCycleCheckForTest(nC.id, nA.id); // Cycle 1

    graphStore.addEdge(nB.id, nD.id);
    graphStore.addEdge(nD.id, nE.id);
    addEdgeWithoutCycleCheckForTest(nE.id, nB.id); // Cycle 2

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Workflow contains circular dependencies / cycles.');
    
    const steps = graphStore.getState().traceSteps;
    const expectedNodeIds = [nA.id, nB.id, nC.id, nD.id, nE.id];
    const stepNodeIds = steps.map(s => s.nodeId);
    const startedExecutionStatuses = ['running'];
    
    expect([...stepNodeIds].sort()).toEqual([...expectedNodeIds].sort());
    expect(steps.every(s => s.status === 'failed')).toBe(true);
    expect(steps.some(s => startedExecutionStatuses.includes(s.status))).toBe(false);
    expect(steps.some(s => s.status === 'completed')).toBe(false);
    expect(steps.every(s => s.log?.includes('Cycle detected in graph'))).toBe(true);
  });

  it('handles a cycle in one disconnected component while another is clean', async () => {
    // Component 1: nA -> nB -> nA (Cycle)
    // Component 2: nC -> nD (Clean)
    const nA = graphStore.addNode('Prompt');
    const nB = graphStore.addNode('LLM');
    graphStore.addEdge(nA.id, nB.id);
    addEdgeWithoutCycleCheckForTest(nB.id, nA.id);

    const nC = graphStore.addNode('Prompt');
    const nD = graphStore.addNode('Output');
    graphStore.addEdge(nC.id, nD.id);

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Workflow contains circular dependencies / cycles.');

    const steps = graphStore.getState().traceSteps;
    const DISCONNECTED_COMPONENT_NODE_COUNT = 4;
    const expectedStepCount = DISCONNECTED_COMPONENT_NODE_COUNT;
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
    const FETCH_DELAY_EXCEEDING_TIMEOUT_MS = 150;

    const mockFetch = createMockFetch({
      delayMs: FETCH_DELAY_EXCEEDING_TIMEOUT_MS,
      response: { choices: [{ message: { content: 'success' } }], usage: { total_tokens: 10 } },
      onAbort: () => {
        fetchAborted = true;
      }
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
    const MAX_CONCURRENCY_LIMIT = 5;

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

    // Run with maxConcurrency = MAX_CONCURRENCY_LIMIT
    const steps = await executeWorkflow({ fallback: false, maxConcurrency: MAX_CONCURRENCY_LIMIT });

    const expectedSteps = numParallel + WORKFLOW_START_NODES + WORKFLOW_END_NODES;
    expect(steps.length).toBe(expectedSteps);
    expect(steps.every(s => s.status === 'completed')).toBe(true);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(MAX_CONCURRENCY_LIMIT);

    // The output node should have received inputs from all parallel branches
    const endStep = steps.find(s => s.nodeId === nEnd.id);
    expect(endStep).toBeDefined();
    const endInput = endStep?.input;
    expect(endInput).toBeDefined();
    expect(Object.keys(endInput ?? {}).length).toBe(numParallel);
  });

  // ==========================================
  // 4. RACE CONDITIONS & OUT-OF-ORDER RESOLUTION
  // ==========================================

  it('correctly handles nodes completing in out-of-order sequence', async () => {
    // Two independent LLM nodes
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');
    const SLOW_PROMPT = 'out-of-order-slow-prompt';
    const FAST_PROMPT = 'out-of-order-fast-prompt';

    // Explicitly configure per-prompt delays for deterministic out-of-order completion.
    const promptDelayMs = new Map<string, number>([
      [SLOW_PROMPT, SLOW_NODE_DELAY_MS],
      [FAST_PROMPT, DEFAULT_MOCK_DELAY_MS]
    ]);
    const validPrompts = new Set<string>(promptDelayMs.keys());

    const observedPrompts: string[] = [];
    const completionTimes = new Map<string, number>();

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const prompt = extractPromptFromRequest(init);
      if (!validPrompts.has(prompt)) {
        throw new Error(
          `Unexpected prompt extracted in out-of-order test: "${prompt}". Expected one of: ${Array.from(validPrompts).join(', ')}`
        );
      }
      observedPrompts.push(prompt);
      const delay = promptDelayMs.get(prompt) ?? DEFAULT_MOCK_DELAY_MS;
      return new Promise((resolve) => {
        setTimeout(() => {
          completionTimes.set(prompt, Date.now());
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
    graphStore.updateNodeData(p1.id, { promptTemplate: SLOW_PROMPT });
    graphStore.addEdge(p1.id, n1.id);

    const p2 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p2.id, { promptTemplate: FAST_PROMPT });
    graphStore.addEdge(p2.id, n2.id);

    await executeWorkflow({ fallback: false, maxConcurrency: OUT_OF_ORDER_TEST_CONCURRENCY });

    expect(
      observedPrompts.length,
      `Expected exactly 2 prompts but got ${observedPrompts.length}: ${observedPrompts.join(', ')}`
    ).toBe(2);
    expect(
      observedPrompts.every(prompt => promptDelayMs.has(prompt)),
      `Unexpected prompt(s): ${observedPrompts.filter(prompt => !promptDelayMs.has(prompt)).join(', ')}. Expected only: ${Array.from(promptDelayMs.keys()).join(', ')}`
    ).toBe(true);

    expect(
      completionTimes.has(SLOW_PROMPT) && completionTimes.has(FAST_PROMPT),
      `Missing completion timestamps. Got: ${Array.from(completionTimes.keys()).join(', ')}`
    ).toBe(true);
    const fastCompletion = completionTimes.get(FAST_PROMPT);
    const slowCompletion = completionTimes.get(SLOW_PROMPT);
    expect(fastCompletion).toBeDefined();
    expect(slowCompletion).toBeDefined();

    const MIN_EXPECTED_GAP_MS = SLOW_NODE_DELAY_MS - DEFAULT_MOCK_DELAY_MS;
    expect(
      fastCompletion! < slowCompletion!,
      `Expected ${FAST_PROMPT} to complete before ${SLOW_PROMPT}, but got times fast=${fastCompletion} slow=${slowCompletion}`
    ).toBe(true);
    expect(
      slowCompletion! - fastCompletion! >= MIN_EXPECTED_GAP_MS - TIMING_TOLERANCE_MS,
      `Expected completion gap to be at least ${MIN_EXPECTED_GAP_MS}ms (allowing ${TIMING_TOLERANCE_MS}ms tolerance), but got ${(slowCompletion! - fastCompletion!)}ms`
    ).toBe(true);

    const steps = graphStore.getState().traceSteps;
    expect(steps.length).toBe(4);
    expect(steps.every(s => s.status === 'completed')).toBe(true);

    const stepN1 = steps.find(s => s.nodeId === n1.id);
    const stepN2 = steps.find(s => s.nodeId === n2.id);

    expect(stepN1?.output).toBe(`Response to ${SLOW_PROMPT}`);
    expect(stepN2?.output).toBe(`Response to ${FAST_PROMPT}`);
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
    const {
      nodes: beforeNodes,
      edges: beforeEdges,
      traceSteps: beforeTraceSteps,
      history: beforeHistory,
      selectedRunId: beforeSelectedRunId
    } = graphStore.getState();
    const beforeHistoryLength = beforeHistory.length;

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

  it('displays stored run trace steps correctly in replay mode', async () => {
    const n1 = graphStore.addNode('Prompt');
    const n2 = graphStore.addNode('Prompt');
    graphStore.addEdge(n1.id, n2.id);

    await executeWorkflow({ fallback: true });

    const stateAfterRun = graphStore.getState();
    expect(stateAfterRun.history.length).toBe(1);

    const storedRun = stateAfterRun.history[0];
    expect(storedRun.traceSteps.length).toBeGreaterThan(0);

    graphStore.selectRun(storedRun.id);
    const replayState = graphStore.getState();

    expect(replayState.selectedRunId).toBe(storedRun.id);
    expect(replayState.traceSteps).toEqual(storedRun.traceSteps);

    const replayNodeIds = new Set(replayState.nodes.map(n => n.id));
    for (const step of replayState.traceSteps) {
      expect(replayNodeIds.has(step.nodeId)).toBe(true);
    }
  });
});
