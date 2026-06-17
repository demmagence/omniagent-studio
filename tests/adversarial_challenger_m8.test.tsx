import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Milestone 8: Adversarial & Stress Testing', () => {
  const addEdgeUnsafeForTest = (source: string, target: string, id = `cycle_${Math.random()}`) => {
    const unsafeEdge = { id, source, target };
    const state = graphStore.getState();
    graphStore.setGraph(state.nodes, [...state.edges, unsafeEdge]);
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
    addEdgeUnsafeForTest(nC.id, nA.id); // Cycle 1

    graphStore.addEdge(nB.id, nD.id);
    graphStore.addEdge(nD.id, nE.id);
    addEdgeUnsafeForTest(nE.id, nB.id); // Cycle 2

    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Workflow contains circular dependencies / cycles.');
    
    const steps = graphStore.getState().traceSteps;
    expect(steps.length).toBe(5);
    expect(steps.every(s => s.status === 'failed')).toBe(true);
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
    expect(steps.length).toBe(4);
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

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const signal = init?.signal;
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
        }, 1000); // Exceeds execution timeout
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run with 50ms timeout
    const promise = executeWorkflow({ fallback: false, timeoutMs: 50 });
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
    // nStart fanning out to 50 parallel nodes, fanning back in to nEnd
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

    const mockFetch = vi.fn().mockImplementation(() => {
      currentConcurrency++;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
      return new Promise((resolve) => {
        setTimeout(() => {
          currentConcurrency--;
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'parallel-result' } }],
              usage: { total_tokens: 5 }
            })
          });
        }, 10);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run with maxConcurrency = 5
    const steps = await executeWorkflow({ fallback: false, maxConcurrency: 5 });

    expect(steps.length).toBe(52);
    expect(steps.every(s => s.status === 'completed')).toBe(true);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(5);

    // The output node should have received inputs from all parallel branches
    const endStep = steps.find(s => s.nodeId === nEnd.id);
    expect(endStep).toBeDefined();
    expect(endStep?.input).toBeDefined();
    if (!endStep || !endStep.input) {
      throw new Error('Expected output step with defined input');
    }
    expect(Object.keys(endStep.input).length).toBe(50);
  });

  // ==========================================
  // 4. RACE CONDITIONS & OUT-OF-ORDER RESOLUTION
  // ==========================================

  it('correctly handles nodes completing in out-of-order sequence', async () => {
    // Two independent LLM nodes
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM');

    // n1 takes 50ms, n2 takes 10ms
    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body);
      const prompt = body.messages[body.messages.length - 1].content;
      const delay = prompt === 'n1' ? 50 : 10;
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

    // Call executeWorkflow should throw
    await expect(executeWorkflow({ fallback: true })).rejects.toThrow('Cannot execute workflow during replay');
    
    // Exit replay mode
    graphStore.selectRun(null);
  });
});
