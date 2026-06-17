import { describe, it, expect, beforeEach, vi } from 'vitest';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Milestone 8 Adversarial: Cycle Handling, Timeouts, High Load, and Race Conditions', () => {
  beforeEach(() => {
    graphStore.resetGraph();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Cycle Handling', () => {
    it('detects a simple self-cycle (A -> A) and aborts immediately', async () => {
      const nodeA = graphStore.addNode('LLM');
      // Manually set a self-loop edge because addEdge filters self-loops
      const selfEdge = { id: 'self-loop', source: nodeA.id, target: nodeA.id };
      graphStore.setGraph([nodeA], [selfEdge]);

      await expect(executeWorkflow({ fallback: true })).rejects.toThrow(
        'Workflow contains circular dependencies / cycles.'
      );

      const state = graphStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.traceSteps.length).toBe(1);
      expect(state.traceSteps[0].status).toBe('failed');
      expect(state.traceSteps[0].log).toBe('Execution aborted: Cycle detected in graph');
      expect(state.history.length).toBe(1);
      expect(state.history[0].status).toBe('failure');
    });

    it('detects a direct cycle (A -> B -> A) and aborts immediately', async () => {
      const nodeA = graphStore.addNode('LLM');
      const nodeB = graphStore.addNode('LLM');
      
      graphStore.addEdge(nodeA.id, nodeB.id);
      graphStore.addEdge(nodeB.id, nodeA.id);

      await expect(executeWorkflow({ fallback: false })).rejects.toThrow(
        'Workflow contains circular dependencies / cycles.'
      );

      const state = graphStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.traceSteps.every(s => s.status === 'failed')).toBe(true);
      expect(state.traceSteps.every(s => s.log === 'Execution aborted: Cycle detected in graph')).toBe(true);
      expect(state.history[0].status).toBe('failure');
    });

    it('detects an indirect cycle (A -> B -> C -> A) and aborts immediately', async () => {
      const nodeA = graphStore.addNode('LLM');
      const nodeB = graphStore.addNode('LLM');
      const nodeC = graphStore.addNode('LLM');

      graphStore.addEdge(nodeA.id, nodeB.id);
      graphStore.addEdge(nodeB.id, nodeC.id);
      graphStore.addEdge(nodeC.id, nodeA.id);

      await expect(executeWorkflow({ fallback: false })).rejects.toThrow(
        'Workflow contains circular dependencies / cycles.'
      );
    });

    it('detects a cycle in a disconnected sub-graph and aborts the entire execution', async () => {
      // Valid path: A -> B
      const nodeA = graphStore.addNode('LLM');
      const nodeB = graphStore.addNode('LLM');
      graphStore.addEdge(nodeA.id, nodeB.id);

      // Cyclical path: C -> D -> C
      const nodeC = graphStore.addNode('LLM');
      const nodeD = graphStore.addNode('LLM');
      graphStore.addEdge(nodeC.id, nodeD.id);
      graphStore.addEdge(nodeD.id, nodeC.id);

      await expect(executeWorkflow({ fallback: false })).rejects.toThrow(
        'Workflow contains circular dependencies / cycles.'
      );

      // Verify all nodes, including the valid ones, are marked failed and aborted
      const state = graphStore.getState();
      expect(state.traceSteps.length).toBe(4);
      expect(state.traceSteps.every(s => s.status === 'failed')).toBe(true);
    });
  });

  describe('Timeout Scenarios', () => {
    it('aborts active nodes and fails workflow if execution exceeds timeoutMs', async () => {
      const nodeA = graphStore.addNode('LLM');
      graphStore.updateNodeData(nodeA.id, { label: 'SlowNode' });

      let nodeAAborted = false;

      const mockFetch = vi.fn().mockImplementation((_url, init) => {
        const signal = init.signal;
        return new Promise((resolve, reject) => {
          const onAbort = () => {
            nodeAAborted = true;
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          };
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener('abort', onAbort);

          // Simulate long running LLM call
          setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: 'done' } }],
                usage: { total_tokens: 5 }
              })
            });
          }, 100);
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      // Run with timeoutMs = 30ms (less than 100ms)
      await expect(executeWorkflow({ fallback: false, timeoutMs: 30 })).rejects.toThrow(
        'Workflow execution timed out after 30ms'
      );

      expect(nodeAAborted).toBe(true);
      
      const state = graphStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.traceSteps[0].status).toBe('failed');
      expect(state.traceSteps[0].log).toContain('Aborted: Workflow execution timed out after 30ms');
      expect(state.history[0].status).toBe('failure');
    });

    it('clears timeout handles and does not leak when execution completes before timeoutMs', async () => {
      graphStore.addNode('LLM');
      
      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'done' } }],
            usage: { total_tokens: 5 }
          })
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const spyClearTimeout = vi.spyOn(globalThis, 'clearTimeout');

      await executeWorkflow({ fallback: false, timeoutMs: 1000 });

      expect(spyClearTimeout).toHaveBeenCalled();
      const state = graphStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.traceSteps[0].status).toBe('completed');
      expect(state.history[0].status).toBe('success');
    });
  });

  describe('High Load & Concurrency Control', () => {
    it('correctly throttles execution to maxConcurrency under high load (100 nodes)', async () => {
      const totalNodes = 100;
      const maxConcurrency = 5;
      const nodes: any[] = [];

      for (let i = 0; i < totalNodes; i++) {
        const node = graphStore.addNode('LLM');
        graphStore.updateNodeData(node.id, { label: `Node_${i}` });
        nodes.push(node);
      }

      let activeRequests = 0;
      let maxActiveRequests = 0;

      const mockFetch = vi.fn().mockImplementation(() => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        
        return new Promise((resolve) => {
          // Finish quickly to process all 100 nodes rapidly
          setTimeout(() => {
            activeRequests--;
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: 'response' } }],
                usage: { total_tokens: 1 }
              })
            });
          }, 5);
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const promise = executeWorkflow({ fallback: false, maxConcurrency });

      // Periodically check that concurrency is not exceeded during execution
      const interval = setInterval(() => {
        const runningCount = graphStore.getState().traceSteps.filter(s => s.status === 'running').length;
        expect(runningCount).toBeLessThanOrEqual(maxConcurrency);
      }, 2);

      await promise;
      clearInterval(interval);

      const state = graphStore.getState();
      expect(state.traceSteps.length).toBe(totalNodes);
      expect(state.traceSteps.every(s => s.status === 'completed')).toBe(true);
      expect(maxActiveRequests).toBeLessThanOrEqual(maxConcurrency);
    });

    it('correctly traverses a deep parallel DAG structure with maxConcurrency', async () => {
      // Construct 5 parallel paths, each path has 3 sequential nodes: A_i -> B_i -> C_i
      const pathsCount = 5;
      const maxConcurrency = 3;

      for (let i = 0; i < pathsCount; i++) {
        const nodeA = graphStore.addNode('LLM');
        const nodeB = graphStore.addNode('LLM');
        const nodeC = graphStore.addNode('LLM');

        graphStore.updateNodeData(nodeA.id, { label: `A_${i}` });
        graphStore.updateNodeData(nodeB.id, { label: `B_${i}` });
        graphStore.updateNodeData(nodeC.id, { label: `C_${i}` });

        graphStore.addEdge(nodeA.id, nodeB.id);
        graphStore.addEdge(nodeB.id, nodeC.id);
      }

      let activeRequests = 0;
      let maxActiveRequests = 0;

      const mockFetch = vi.fn().mockImplementation(() => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

        return new Promise((resolve) => {
          setTimeout(() => {
            activeRequests--;
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: 'done' } }],
                usage: { total_tokens: 2 }
              })
            });
          }, 10);
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      await executeWorkflow({ fallback: false, maxConcurrency });

      const state = graphStore.getState();
      expect(state.traceSteps.every(s => s.status === 'completed')).toBe(true);
      expect(maxActiveRequests).toBeLessThanOrEqual(maxConcurrency);
    });
  });

  describe('Race Conditions & Simultaneous Actions', () => {
    it('handles multiple concurrent node failures gracefully without crashing', async () => {
      // 3 independent nodes: 2 fail, 1 succeeds
      const n1 = graphStore.addNode('LLM');
      const n2 = graphStore.addNode('LLM');
      const n3 = graphStore.addNode('LLM');

      graphStore.updateNodeData(n1.id, { label: 'Failer 1' });
      graphStore.updateNodeData(n2.id, { label: 'Failer 2' });
      graphStore.updateNodeData(n3.id, { label: 'Succeeder' });

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

      const mockFetch = vi.fn().mockImplementation((_url, init) => {
        const body = JSON.parse(init.body);
        const prompt = body.messages[body.messages.length - 1].content;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (prompt === 'n1') {
              reject(new Error('Failure 1'));
            } else if (prompt === 'n2') {
              reject(new Error('Failure 2'));
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
          }, 20); // Both fail at the exact same time
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      // Run and expect rejection with one of the errors
      await expect(executeWorkflow({ fallback: false, maxConcurrency: 5 })).rejects.toThrow();

      const state = graphStore.getState();
      expect(state.isRunning).toBe(false);
      // Both failers or at least one should be failed, and the other aborted
      const steps = state.traceSteps;
      const n1Step = steps.find(s => s.nodeId === n1.id);
      const n2Step = steps.find(s => s.nodeId === n2.id);
      
      expect([n1Step?.status, n2Step?.status]).toContain('failed');
    });

    it('highlights race condition in concurrent executeWorkflow calls', async () => {
      // If we execute workflow twice concurrently, they will interfere with the single global state.
      graphStore.addNode('LLM');
      
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
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

      // Launch two workflow executions concurrently
      const p1 = executeWorkflow({ fallback: false });
      const p2 = executeWorkflow({ fallback: false });

      await Promise.all([p1, p2]);

      const state = graphStore.getState();
      // Since they ran concurrently and both updated traceSteps and status, we verify they complete.
      // But because the state is shared, it is a race condition. Let's document this behavior.
      expect(state.isRunning).toBe(false);
      expect(state.traceSteps.length).toBe(1);
    });
  });
});
