import { graphStore } from '../store/graphStore';
import { hasCycle } from '../utils/graphUtils';
import { Node, TraceStep, Edge } from '../types';

export { getWordFrequency, calculateCosineSimilarity } from './executors/utils';
export type { ExecutionOptions, NodeExecutionResult, NodeExecutionContext } from './executors';
import { nodeExecutors, ExecutionOptions, NodeExecutionContext } from './executors';

class WorkflowExecutor {
  private nodes: Node[];
  private edges: Edge[];
  private fallback: boolean;
  private timeoutMs: number;
  private maxConcurrency: number;
  private nodeMap: Map<string, Node>;
  private outputs: Map<string, any>;
  private incomingEdgesMap: Map<string, Edge[]>;
  private outgoingEdgesMap: Map<string, Edge[]>;
  private pendingDependencies: Map<string, number>;
  private readyNodesQueue: Node[];
  private completedNodes: Set<string>;
  private runningNodes: Set<string>;
  private aborted: boolean;
  private firstError: Error | null;
  private abortController: AbortController;
  private resolveRun!: (value: TraceStep[]) => void;
  private rejectRun!: (reason?: any) => void;

  constructor(options: ExecutionOptions) {
    const { nodes, edges, isFallbackMode, maxConcurrency: storeMaxConcurrency } = graphStore.getState();
    this.nodes = nodes;
    this.edges = edges;
    this.fallback = options.fallback !== undefined ? options.fallback : isFallbackMode;
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 30000;
    this.maxConcurrency = options.maxConcurrency !== undefined ? options.maxConcurrency : storeMaxConcurrency;

    this.nodeMap = new Map<string, Node>(this.nodes.map(n => [n.id, n]));
    this.outputs = new Map<string, any>();

    this.incomingEdgesMap = new Map<string, Edge[]>();
    this.outgoingEdgesMap = new Map<string, Edge[]>();
    this.pendingDependencies = new Map<string, number>();
    this.readyNodesQueue = [];

    for (const node of this.nodes) {
      this.pendingDependencies.set(node.id, 0);
    }

    for (const edge of this.edges) {
      const target = edge.target;
      const source = edge.source;

      if (this.nodeMap.has(target)) {
        const edgeList = this.incomingEdgesMap.get(target);
        if (edgeList) {
          edgeList.push(edge);
        } else {
          this.incomingEdgesMap.set(target, [edge]);
        }

        this.pendingDependencies.set(target, (this.pendingDependencies.get(target) || 0) + 1);
      }

      if (this.nodeMap.has(source)) {
        const outEdgeList = this.outgoingEdgesMap.get(source);
        if (outEdgeList) {
          outEdgeList.push(edge);
        } else {
          this.outgoingEdgesMap.set(source, [edge]);
        }
      }
    }

    this.completedNodes = new Set<string>();
    this.runningNodes = new Set<string>();
    this.aborted = false;
    this.firstError = null;
    this.abortController = new AbortController();
  }

  private getIncomingInputs(targetId: string) {
    const incomingEdges = this.incomingEdgesMap.get(targetId) || [];
    if (incomingEdges.length === 0) return null;
    if (incomingEdges.length === 1) {
      return this.outputs.get(incomingEdges[0].source);
    }
    const result: Record<string, any> = {};
    incomingEdges.forEach((edge, idx) => {
      const sourceNode = this.nodeMap.get(edge.source);
      const key = edge.sourcePort || sourceNode?.data.label || `input_${idx}`;
      result[key] = this.outputs.get(edge.source);
    });
    return result;
  }

  private async executeNode(nodeId: string) {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    if (this.aborted) return;

    graphStore.updateTraceStep({
      nodeId,
      status: 'running',
      log: `Starting execution of ${node.data.label}`,
    });

    const incomingInput = this.getIncomingInputs(nodeId);

    const executor = nodeExecutors[node.type];
    if (!executor) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    const executionContext: NodeExecutionContext = {
      node,
      incomingInput,
      fallback: this.fallback,
      abortController: this.abortController,
      graphStore
    };

    const result = await executor(executionContext);
    const nodeInput = result.nodeInput !== undefined ? result.nodeInput : incomingInput;
    const { nodeOutput, log, tokensUsed } = result;

    if (this.aborted) return;

    this.outputs.set(nodeId, nodeOutput);
    graphStore.updateTraceStep({
      nodeId,
      status: 'completed',
      input: nodeInput,
      output: nodeOutput,
      log,
      tokensConsumed: tokensUsed,
    });
  }

  private updateDependencies(nodeId: string) {
    const outEdges = this.outgoingEdgesMap.get(nodeId) || [];
    for (const edge of outEdges) {
      const target = edge.target;
      if (this.nodeMap.has(target)) {
        const currentDeps = this.pendingDependencies.get(target) || 0;
        if (currentDeps > 0) {
          this.pendingDependencies.set(target, currentDeps - 1);
          if (currentDeps - 1 === 0) {
            this.readyNodesQueue.push(this.nodeMap.get(target)!);
          }
        }
      }
    }
  }

  private checkAndRunNext() {
    if (this.aborted) return;

    if (this.completedNodes.size === this.nodes.length) {
      this.resolveRun(graphStore.getState().traceSteps);
      return;
    }

    if (this.readyNodesQueue.length === 0 && this.runningNodes.size === 0) {
      if (this.completedNodes.size === this.nodes.length) {
        this.resolveRun(graphStore.getState().traceSteps);
        return;
      }

      const incompleteNodeIds: string[] = [];
      for (const n of this.nodes) {
        if (!this.completedNodes.has(n.id)) {
          incompleteNodeIds.push(n.id);
        }
      }
      this.rejectRun(new Error(`Workflow is stuck: no runnable nodes and no running nodes. Incomplete nodes: ${incompleteNodeIds.join(', ')}`));
      return;
    }

    while (this.readyNodesQueue.length > 0 && this.runningNodes.size < this.maxConcurrency) {
      const node = this.readyNodesQueue.shift()!;

      if (this.runningNodes.has(node.id) || this.completedNodes.has(node.id)) {
        continue;
      }

      const nodeId = node.id;
      this.runningNodes.add(nodeId);

      this.executeNode(nodeId).then(() => {
        this.runningNodes.delete(nodeId);
        this.completedNodes.add(nodeId);

        this.updateDependencies(nodeId);

        this.checkAndRunNext();
      }).catch(err => {
        this.runningNodes.delete(nodeId);
        if (!this.aborted) {
          this.aborted = true;
          this.firstError = err instanceof Error ? err : new Error(String(err));
          this.abortController.abort();

          const errMsg = this.firstError.message;
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

          this.rejectRun(this.firstError);
        }
      });
    }
  }

  public async execute(): Promise<TraceStep[]> {
    const { selectedRunId } = graphStore.getState();
    if (selectedRunId !== null) {
      throw new Error('Cannot execute workflow during replay');
    }

    graphStore.setIsRunning(true);
    graphStore.setTraceSteps([]);

    const initialSteps: TraceStep[] = this.nodes.map(n => ({
      nodeId: n.id,
      status: 'pending',
      input: null,
      output: null,
      log: 'Pending execution',
      tokensConsumed: 0
    }));
    graphStore.setTraceSteps(initialSteps);

    if (hasCycle(this.nodes, this.edges)) {
      const errorMsg = 'Workflow contains circular dependencies / cycles.';
      const failedSteps = initialSteps.map(step => ({
        ...step,
        status: 'failed' as const,
        log: 'Execution aborted: Cycle detected in graph'
      }));
      graphStore.setTraceSteps(failedSteps);
      graphStore.setIsRunning(false);
      graphStore.addRunToHistory({
        nodes: this.nodes,
        edges: this.edges,
        traceSteps: failedSteps,
        status: 'failure'
      });
      throw new Error(errorMsg);
    }

    const runPromise = new Promise<TraceStep[]>((resolve, reject) => {
      this.resolveRun = resolve;
      this.rejectRun = reject;

      for (const node of this.nodes) {
        if ((this.pendingDependencies.get(node.id) || 0) === 0) {
          this.readyNodesQueue.push(node);
        }
      }

      this.checkAndRunNext();
    });

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = this.timeoutMs > 0
        ? await Promise.race([
            runPromise,
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error(`Workflow execution timed out after ${this.timeoutMs}ms`));
              }, this.timeoutMs);
            })
          ])
        : await runPromise;
      graphStore.setIsRunning(false);
      graphStore.addRunToHistory({
        nodes: this.nodes,
        edges: this.edges,
        traceSteps: graphStore.getState().traceSteps,
        status: 'success'
      });
      return result;
    } catch (error) {
      this.aborted = true;
      this.abortController.abort();
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
        nodes: this.nodes,
        edges: this.edges,
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
}

export async function executeWorkflow(options: ExecutionOptions = {}): Promise<TraceStep[]> {
  const executor = new WorkflowExecutor(options);
  return executor.execute();
}
