import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

// Simulated per-request latencies for the mocked LLM fetch. Named so the
// relative ordering (a fast-failing node vs. a slower one that must be aborted)
// is explicit rather than encoded in bare numbers.
const FAST_NODE_DELAY_MS = 20;
const SLOW_NODE_DELAY_MS = 100;
// Uniform simulated latency used when only the concurrency ceiling matters.
const NODE_EXECUTION_DELAY_MS = 30;
// Per-node latency for the concurrency-ceiling probe test. Kept comfortably
// above the waitFor poll interval so a node is observably 'running' mid-flight.
const CONCURRENT_NODE_DELAY_MS = 50;

// Poll a condition instead of sleeping for a fixed duration, so timing-sensitive
// assertions don't race against the scheduler. If the condition is never met
// (e.g. a scheduler regression where no node ever starts), this rejects with a
// descriptive error naming what was awaited — turning that failure mode into a
// meaningful, explicit test failure instead of a silent hang. The behaviour is
// exercised directly by the "waitFor rejects ..." test below.
async function waitFor(
  condition: () => boolean,
  {
    timeout = 1000,
    interval = 5,
    description = 'condition',
  }: { timeout?: number; interval?: number; description?: string } = {}
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor: ${description} not met before ${timeout}ms timeout`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

describe('Milestone 8: Parallel Execution Core', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('runs independent nodes concurrently up to maxConcurrency', async () => {
    // Add 4 independent LLM nodes
    graphStore.addNode('LLM');
    graphStore.addNode('LLM');
    graphStore.addNode('LLM');
    graphStore.addNode('LLM');

    // We stub fetch to take some time
    const activeRequests: string[] = [];
    // Tracks the peak number of concurrently in-flight requests observed.
    let maxActiveRequests = 0;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body);
      const prompt = body.messages[body.messages.length - 1].content;
      activeRequests.push(prompt);
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests.length);

      return new Promise((resolve) => {
        setTimeout(() => {
          const idx = activeRequests.indexOf(prompt);
          if (idx !== -1) {
            activeRequests.splice(idx, 1);
          }
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: `Response to ${prompt}` } }],
              usage: { total_tokens: 10 }
            })
          });
        }, CONCURRENT_NODE_DELAY_MS);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run workflow with maxConcurrency = 2
    const maxConcurrency = 2;
    const promise = executeWorkflow({ fallback: false, maxConcurrency });

    // Wait until the scheduler has actually started a node rather than sleeping
    // for a fixed duration. The concurrency ceiling holds at every moment of the
    // run, so sampling once a node is running is sufficient to verify it. If no
    // node ever starts, waitFor rejects with the description below instead of
    // hanging (see the dedicated waitFor timeout test).
    await waitFor(
      () => graphStore.getState().traceSteps.some(s => s.status === 'running'),
      { description: 'a node to reach running status' }
    );

    // We have 4 nodes, so no more than `maxConcurrency` may be running at once.
    const stepsDuring = graphStore.getState().traceSteps;
    const runningCount = stepsDuring.filter(s => s.status === 'running').length;
    // Assert that the scheduler actually started work, so a missed `running`
    // window surfaces as a meaningful assertion rather than a waitFor timeout.
    expect(runningCount).toBeGreaterThan(0);
    expect(runningCount).toBeLessThanOrEqual(maxConcurrency);

    await promise;

    // Finally all should be completed
    const finalSteps = graphStore.getState().traceSteps;
    expect(finalSteps.every(s => s.status === 'completed')).toBe(true);
    expect(maxActiveRequests).toBeLessThanOrEqual(maxConcurrency);
  });

  it('performs fail-fast abort on node execution failure', async () => {
    const n1 = graphStore.addNode('LLM');
    const n2 = graphStore.addNode('LLM'); // This one will fail
    const n3 = graphStore.addNode('LLM'); // This one will take longer and should be aborted

    let n3Aborted = false;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body);
      const prompt = body.messages[body.messages.length - 1].content;
      const signal = init.signal;

      return new Promise((resolve, reject) => {
        const onAbort = () => {
          if (prompt === 'n3') {
            n3Aborted = true;
          }
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };

        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort);

        setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          if (prompt === 'n2') {
            reject(new Error('Node 2 failed purposely'));
          } else {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: 'success' } }],
                usage: { total_tokens: 10 }
              })
            });
          }
        }, prompt === 'n2' ? FAST_NODE_DELAY_MS : SLOW_NODE_DELAY_MS);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Update node data to differentiate inputs
    graphStore.updateNodeData(n1.id, { label: 'Node 1' });
    graphStore.updateNodeData(n2.id, { label: 'Node 2' });
    graphStore.updateNodeData(n3.id, { label: 'Node 3' });
    
    // We'll set prompts that are passed as inputs
    const p1 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p1.id, { promptTemplate: 'n1' });
    graphStore.addEdge(p1.id, n1.id);

    const p2 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p2.id, { promptTemplate: 'n2' });
    graphStore.addEdge(p2.id, n2.id);

    const p3 = graphStore.addNode('Prompt');
    graphStore.updateNodeData(p3.id, { promptTemplate: 'n3' });
    graphStore.addEdge(p3.id, n3.id);

    // Run the workflow with maxConcurrency = 6 so they all run concurrently
    await expect(executeWorkflow({ fallback: false, maxConcurrency: 6 })).rejects.toThrow('Node 2 failed purposely');

    // Node 3 should have been aborted
    expect(n3Aborted).toBe(true);

    const steps = graphStore.getState().traceSteps;
    const n3Step = steps.find(s => s.nodeId === n3.id);
    expect(n3Step).toBeDefined();
    // The assertion above guarantees presence; use a non-null assertion rather
    // than optional chaining so a regression that drops the step fails loudly
    // instead of being silently masked by `?.` short-circuiting to undefined.
    expect(n3Step!.status).toBe('failed');
    expect(n3Step!.log).toContain('Aborted:');
  });

  it('respects maxConcurrency option of 1 (sequential execution)', async () => {
    graphStore.addNode('LLM');
    graphStore.addNode('LLM');
    graphStore.addNode('LLM');

    let maxRunning = 0;
    let currentlyRunning = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      currentlyRunning++;
      maxRunning = Math.max(maxRunning, currentlyRunning);
      return new Promise((resolve) => {
        setTimeout(() => {
          currentlyRunning--;
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'done' } }],
              usage: { total_tokens: 5 }
            })
          });
        }, NODE_EXECUTION_DELAY_MS);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    await executeWorkflow({ fallback: false, maxConcurrency: 1 });

    expect(maxRunning).toBe(1);
    const steps = graphStore.getState().traceSteps;
    expect(steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('respects maxConcurrency from graphStore if not overridden', async () => {
    act(() => {
      graphStore.setMaxConcurrency(1);
      // Add 3 independent LLM nodes
      graphStore.addNode('LLM');
      graphStore.addNode('LLM');
      graphStore.addNode('LLM');
    });

    let maxRunning = 0;
    let currentlyRunning = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      currentlyRunning++;
      maxRunning = Math.max(maxRunning, currentlyRunning);
      return new Promise((resolve) => {
        setTimeout(() => {
          currentlyRunning--;
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'done' } }],
              usage: { total_tokens: 5 }
            })
          });
        }, NODE_EXECUTION_DELAY_MS);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // executeWorkflow called WITHOUT maxConcurrency option should fallback to store setting (1)
    await executeWorkflow({ fallback: false });

    expect(maxRunning).toBe(1);
    const steps = graphStore.getState().traceSteps;
    expect(steps.every(s => s.status === 'completed')).toBe(true);
  });

  it('renders maxConcurrency control in Sidebar and updates store state', () => {
    render(<Sidebar />);

    const maxConcurrencyInput = screen.getByTestId('max-concurrency-input') as HTMLInputElement;
    expect(maxConcurrencyInput.value).toBe('3');

    fireEvent.change(maxConcurrencyInput, { target: { value: '5' } });

    expect(graphStore.getState().maxConcurrency).toBe(5);
  });

  it('waitFor rejects with a descriptive error when the condition is never met', async () => {
    // Explicitly exercises the timeout failure mode the concurrency test relies
    // on: when the awaited condition never becomes true, waitFor must reject
    // (not hang) with a message naming what was awaited.
    await expect(
      waitFor(() => false, { timeout: 20, interval: 5, description: 'an impossible condition' })
    ).rejects.toThrow('an impossible condition not met before 20ms timeout');
  });
});
