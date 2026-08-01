import { Node, Edge, TraceStep } from '../types';

export const cloneNodes = (nodes: Node[]): Node[] => {
  return nodes.map(n => {
    const { apiKey, ...restData } = n.data;
    return {
      ...n,
      position: { ...n.position },
      data: restData,
    };
  });
};

export const cloneEdges = (edges: Edge[]): Edge[] => {
  return edges.map(e => ({ ...e }));
};

export const cloneTraceSteps = (steps: TraceStep[]): TraceStep[] => {
  return steps.map(s => ({
    ...s,
    input: s.input ? structuredClone(s.input) : s.input,
    output: s.output ? structuredClone(s.output) : s.output,
  }));
};
