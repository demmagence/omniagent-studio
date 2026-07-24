import { graphStore } from '../store/graphStore';
import { hasCycle } from '../utils/graphUtils';
import { Node, TraceStep } from '../types';

export { getWordFrequency, calculateCosineSimilarity } from './executors/utils';
export type { ExecutionOptions, NodeExecutionResult, NodeExecutionContext } from './executors';
import { nodeExecutors, ExecutionOptions, NodeExecutionContext } from './executors';

export async function executeWorkflow(options: ExecutionOptions = {}): Promise<TraceStep[]> {
  const { nodes, edges, isFallbackMode, selectedRunId, maxConcurrency: storeMaxConcurrency } = graphStore.getState();
  if (selectedRunId !== null) {
    throw new Error('Cannot execute workflow during replay');
  }
  const fallback = options.fallback !== undefined ? options.fallback : isFallbackMode;
  const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 30000;
  const maxConcurrency = options.maxConcurrency !== undefined ? options.maxConcurrency : storeMaxConcurrency;

  graphStore.setIsRunning(true);
  graphStore.setTraceSteps([]);

  const initialSteps: TraceStep[] = nodes.map(n => ({
    nodeId: n.id,
    status: 'pending',
    input: null,
    output: null,
    log: 'Pending execution',
    tokensConsumed: 0
  }));
  graphStore.setTraceSteps(initialSteps);

  if (hasCycle(nodes, edges)) {
    const errorMsg = 'Workflow contains circular dependencies / cycles.';
    const failedSteps = initialSteps.map(step => ({
      ...step,
      status: 'failed' as const,
      log: 'Execution aborted: Cycle detected in graph'
    }));
    graphStore.setTraceSteps(failedSteps);
    graphStore.setIsRunning(false);
    graphStore.addRunToHistory({
      nodes,
      edges,
      traceSteps: failedSteps,
      status: 'failure'
    });
    throw new Error(errorMsg);
  }

  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
  const outputs = new Map<string, any>();

  const incomingEdgesMap = new Map<string, typeof edges>();
  for (const node of nodes) {
    incomingEdgesMap.set(node.id, []);
  }
  for (const edge of edges) {
    if (incomingEdgesMap.has(edge.target)) {
      incomingEdgesMap.get(edge.target)!.push(edge);
    }
  }

  const getIncomingInputs = (targetId: string) => {
    const incomingEdges = incomingEdgesMap.get(targetId) || [];
    if (incomingEdges.length === 0) return null;
    if (incomingEdges.length === 1) {
      return outputs.get(incomingEdges[0].source);
    }
    const result: Record<string, any> = {};
    incomingEdges.forEach((edge, idx) => {
      const sourceNode = nodeMap.get(edge.source);
      const key = edge.sourcePort || sourceNode?.data.label || `input_${idx}`;
      result[key] = outputs.get(edge.source);
    });
    return result;
  };

  const completedNodes = new Set<string>();
  const runningNodes = new Set<string>();
  let aborted = false;
  let firstError: Error | null = null;
  const abortController = new AbortController();

  const runPromise = new Promise<TraceStep[]>((resolve, reject) => {
    const checkAndRunNext = () => {
      if (aborted) return;

      if (completedNodes.size === nodes.length) {
        resolve(graphStore.getState().traceSteps);
        return;
      }

      const readyNodes = nodes.filter(node => {
        if (runningNodes.has(node.id) || completedNodes.has(node.id)) {
          return false;
        }
        const incomingEdges = incomingEdgesMap.get(node.id) || [];
        return incomingEdges.every(e => completedNodes.has(e.source));
      });

      if (readyNodes.length === 0 && runningNodes.size === 0) {
        if (completedNodes.size === nodes.length) {
          resolve(graphStore.getState().traceSteps);
          return;
        }

        const incompleteNodeIds = nodes
          .filter(n => !completedNodes.has(n.id))
          .map(n => n.id);
        reject(new Error(`Workflow is stuck: no runnable nodes and no running nodes. Incomplete nodes: ${incompleteNodeIds.join(', ')}`));
        return;
      }

      for (const node of readyNodes) {
        if (runningNodes.size >= maxConcurrency) {
          break;
        }

        const nodeId = node.id;
        runningNodes.add(nodeId);

        executeNode(nodeId).then(() => {
          runningNodes.delete(nodeId);
          completedNodes.add(nodeId);
          checkAndRunNext();
        }).catch(err => {
          runningNodes.delete(nodeId);
          if (!aborted) {
            aborted = true;
            firstError = err instanceof Error ? err : new Error(String(err));
            abortController.abort();
            
            const errMsg = firstError.message;
            graphStore.updateTraceStep({
              nodeId,
              status: 'failed',
              log: `Error executing node: ${errMsg}`,
            });

            const finalSteps = graphStore.getState().traceSteps.map(step => {
              if (step.nodeId !== nodeId && (step.status === 'pending' || step.status === 'running')) {
                return {
                  ...step,
                  status: 'failed' as const,
                  log: `Aborted: ${errMsg}`
                };
              }
              return step;
            });
            graphStore.setTraceSteps(finalSteps);

            reject(firstError);
          }
        });
      }
    };

    const executeNode = async (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      if (aborted) return;

      graphStore.updateTraceStep({
        nodeId,
        status: 'running',
        log: `Starting execution of ${node.data.label}`,
      });

      const incomingInput = getIncomingInputs(nodeId);

      const executor = nodeExecutors[node.type];
      if (!executor) {
        throw new Error(`Unknown node type: ${node.type}`);
      }

      const executionContext: NodeExecutionContext = {
        node,
        incomingInput,
        fallback,
        abortController,
        graphStore
      };

      const result = await executor(executionContext);
      const nodeInput = result.nodeInput !== undefined ? result.nodeInput : incomingInput;
      const { nodeOutput, log, tokensUsed } = result;

      if (aborted) return;

      outputs.set(nodeId, nodeOutput);
      graphStore.updateTraceStep({
        nodeId,
        status: 'completed',
        input: nodeInput,
        output: nodeOutput,
        log,
        tokensConsumed: tokensUsed,
      });
    };

    checkAndRunNext();
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = timeoutMs > 0
      ? await Promise.race([
          runPromise,
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Workflow execution timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          })
        ])
      : await runPromise;
    graphStore.setIsRunning(false);
    graphStore.addRunToHistory({
      nodes,
      edges,
      traceSteps: graphStore.getState().traceSteps,
      status: 'success'
    });
    return result;
  } catch (error) {
    aborted = true;
    abortController.abort();
    graphStore.setIsRunning(false);
    const finalSteps = graphStore.getState().traceSteps.map(step => {
      if (step.status === 'pending' || step.status === 'running') {
        return {
          ...step,
          status: 'failed' as const,
          log: `Aborted: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      return step;
    });
    graphStore.setTraceSteps(finalSteps);
    graphStore.addRunToHistory({
      nodes,
      edges,
      traceSteps: finalSteps,
      status: 'failure'
    });
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
