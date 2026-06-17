import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

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
    const maxActiveRequests = { val: 0 };

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body);
      const prompt = body.messages[body.messages.length - 1].content;
      activeRequests.push(prompt);
      maxActiveRequests.val = Math.max(maxActiveRequests.val, activeRequests.length);

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
        }, 50);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run workflow with maxConcurrency = 2
    const promise = executeWorkflow({ fallback: false, maxConcurrency: 2 });
    
    // Wait slightly to let the first batch start
    await new Promise(r => setTimeout(r, 15));
    
    // We have 4 nodes, so initially 2 should be running and 2 pending
    const stepsDuring = graphStore.getState().traceSteps;
    const runningCount = stepsDuring.filter(s => s.status === 'running').length;
    expect(runningCount).toBeLessThanOrEqual(2);
    
    await promise;

    // Finally all should be completed
    const finalSteps = graphStore.getState().traceSteps;
    expect(finalSteps.every(s => s.status === 'completed')).toBe(true);
    expect(maxActiveRequests.val).toBeLessThanOrEqual(2);
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
        }, prompt === 'n2' ? 20 : 100);
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
    expect(n3Step?.status).toBe('failed');
    expect(n3Step?.log).toContain('Aborted:');
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
        }, 30);
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
        }, 30);
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
});
