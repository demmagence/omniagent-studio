import { useState, useEffect } from 'react';
import { Node, Edge, TraceStep, NodeType, NodeData, RunHistoryEntry } from '../types';

export interface GraphStoreState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  traceSteps: TraceStep[];
  isRunning: boolean;
  isFallbackMode: boolean;
  history: RunHistoryEntry[];
  selectedRunId: string | null;
  maxConcurrency: number;
  canUndo: boolean;
  canRedo: boolean;
}

type Listener = (state: GraphStoreState) => void;

class GraphStore {
  private state: GraphStoreState = {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    traceSteps: [],
    isRunning: false,
    isFallbackMode: true,
    history: [],
    selectedRunId: null,
    maxConcurrency: 3,
    canUndo: false,
    canRedo: false,
  };

  private undoStack: { nodes: Node[]; edges: Edge[] }[] = [];
  private redoStack: { nodes: Node[]; edges: Edge[] }[] = [];

  private draft: { nodes: Node[]; edges: Edge[]; traceSteps: TraceStep[] } | null = null;

  private listeners = new Set<Listener>();

  getState(): GraphStoreState {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  saveHistoryState() {
    this.undoStack.push({
      nodes: JSON.parse(JSON.stringify(this.state.nodes)),
      edges: JSON.parse(JSON.stringify(this.state.edges)),
    });
    this.redoStack = [];
    this.state.canUndo = this.undoStack.length > 0;
    this.state.canRedo = false;
    this.emit();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push({
        nodes: JSON.parse(JSON.stringify(this.state.nodes)),
        edges: JSON.parse(JSON.stringify(this.state.edges)),
      });
      this.state.nodes = previous.nodes;
      this.state.edges = previous.edges;
      if (this.state.selectedNodeId && !this.state.nodes.some((n) => n.id === this.state.selectedNodeId)) {
        this.state.selectedNodeId = null;
      }
      this.state.canUndo = this.undoStack.length > 0;
      this.state.canRedo = this.redoStack.length > 0;
      this.emit();
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push({
        nodes: JSON.parse(JSON.stringify(this.state.nodes)),
        edges: JSON.parse(JSON.stringify(this.state.edges)),
      });
      this.state.nodes = next.nodes;
      this.state.edges = next.edges;
      this.state.canUndo = this.undoStack.length > 0;
      this.state.canRedo = this.redoStack.length > 0;
      this.emit();
    }
  }

  addNode(type: NodeType, position = { x: 100, y: 100 }) {
    this.saveHistoryState();
    const id = `${type}_${Math.random().toString(36).substring(2, 9)}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: `New ${type} Node`,
        type,
      },
    };
    this.state.nodes = [...this.state.nodes, newNode];
    this.emit();
    return newNode;
  }

  removeNode(nodeId: string) {
    this.saveHistoryState();
    this.state.nodes = this.state.nodes.filter((n) => n.id !== nodeId);
    this.state.edges = this.state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    if (this.state.selectedNodeId === nodeId) {
      this.state.selectedNodeId = null;
    }
    this.emit();
  }

  updateNodeData(nodeId: string, data: Partial<NodeData>) {
    this.state.nodes = this.state.nodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    });
    this.emit();
  }

  updateNodePosition(nodeId: string, position: { x: number; y: number }) {
    this.state.nodes = this.state.nodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, position };
      }
      return n;
    });
    this.emit();
  }

  selectNode(nodeId: string | null) {
    this.state.selectedNodeId = nodeId;
    this.emit();
  }

  addEdge(source: string, target: string, sourcePort?: string, targetPort?: string) {
    if (source === target) return null;
    const exists = this.state.edges.some(e => e.source === source && e.target === target);
    if (exists) return null;

    this.saveHistoryState();
    const id = `edge_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`;
    const newEdge: Edge = { id, source, target, sourcePort, targetPort };
    this.state.edges = [...this.state.edges, newEdge];
    this.emit();
    return newEdge;
  }

  removeEdge(edgeId: string) {
    this.saveHistoryState();
    this.state.edges = this.state.edges.filter((e) => e.id !== edgeId);
    this.emit();
  }

  setGraph(nodes: Node[], edges: Edge[]) {
    this.saveHistoryState();
    this.state.nodes = [...nodes];
    this.state.edges = [...edges];
    this.emit();
  }

  setTraceSteps(steps: TraceStep[]) {
    this.state.traceSteps = [...steps];
    this.emit();
  }

  updateTraceStep(step: Partial<TraceStep> & { nodeId: string }) {
    const existingIndex = this.state.traceSteps.findIndex((s) => s.nodeId === step.nodeId);
    if (existingIndex !== -1) {
      this.state.traceSteps = this.state.traceSteps.map((s, idx) =>
        idx === existingIndex ? { ...s, ...step } : s
      );
    } else {
      const newStep: TraceStep = {
        nodeId: step.nodeId,
        status: step.status || 'pending',
        input: step.input || null,
        output: step.output || null,
        log: step.log || '',
        tokensConsumed: step.tokensConsumed || 0,
      };
      this.state.traceSteps = [...this.state.traceSteps, newStep];
    }
    this.emit();
  }

  setIsRunning(isRunning: boolean) {
    this.state.isRunning = isRunning;
    this.emit();
  }

  setFallbackMode(fallback: boolean) {
    this.state.isFallbackMode = fallback;
    this.emit();
  }

  setMaxConcurrency(maxConcurrency: number) {
    this.state.maxConcurrency = maxConcurrency;
    this.emit();
  }

  addRunToHistory(run: Omit<RunHistoryEntry, 'id' | 'timestamp'>) {
    const newEntry: RunHistoryEntry = {
      id: `run_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(run.nodes)),
      edges: JSON.parse(JSON.stringify(run.edges)),
      traceSteps: JSON.parse(JSON.stringify(run.traceSteps)),
      status: run.status,
    };
    this.state.history = [...this.state.history, newEntry];
    this.emit();
  }

  selectRun(runId: string | null) {
    if (runId === null) {
      if (this.draft) {
        this.state.nodes = [...this.draft.nodes];
        this.state.edges = [...this.draft.edges];
        this.state.traceSteps = [...this.draft.traceSteps];
        this.draft = null;
      }
      this.state.selectedRunId = null;
    } else {
      const run = this.state.history.find((r) => r.id === runId);
      if (run) {
        if (this.state.selectedRunId === null) {
          this.draft = {
            nodes: [...this.state.nodes],
            edges: [...this.state.edges],
            traceSteps: [...this.state.traceSteps],
          };
        }
        this.state.nodes = [...run.nodes];
        this.state.edges = [...run.edges];
        this.state.traceSteps = [...run.traceSteps];
        this.state.selectedRunId = runId;
      }
    }
    this.emit();
  }

  clearHistory() {
    this.state.history = [];
    if (this.state.selectedRunId !== null) {
      this.selectRun(null);
    }
    this.emit();
  }

  resetGraph() {
    this.state = {
      nodes: [],
      edges: [],
      selectedNodeId: null,
      traceSteps: [],
      isRunning: false,
      isFallbackMode: true,
      history: [],
      selectedRunId: null,
      maxConcurrency: 3,
      canUndo: false,
      canRedo: false,
    };
    this.undoStack = [];
    this.redoStack = [];
    this.draft = null;
    this.emit();
  }
}

export const graphStore = new GraphStore();

export function useGraphStore() {
  const [state, setState] = useState<GraphStoreState>(graphStore.getState());

  useEffect(() => {
    return graphStore.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
