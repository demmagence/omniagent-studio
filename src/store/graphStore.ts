import { useState, useEffect } from 'react';
import { Node, Edge, TraceStep, NodeType, NodeData } from '../types';

export interface GraphStoreState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  traceSteps: TraceStep[];
  isRunning: boolean;
  isFallbackMode: boolean;
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
  };

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

  addNode(type: NodeType, position = { x: 100, y: 100 }) {
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

    const id = `edge_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`;
    const newEdge: Edge = { id, source, target, sourcePort, targetPort };
    this.state.edges = [...this.state.edges, newEdge];
    this.emit();
    return newEdge;
  }

  removeEdge(edgeId: string) {
    this.state.edges = this.state.edges.filter((e) => e.id !== edgeId);
    this.emit();
  }

  setGraph(nodes: Node[], edges: Edge[]) {
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

  resetGraph() {
    this.state = {
      nodes: [],
      edges: [],
      selectedNodeId: null,
      traceSteps: [],
      isRunning: false,
      isFallbackMode: true,
    };
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
