export type NodeType = 'LLM' | 'Prompt' | 'Tool' | 'Router' | 'Output' | 'VectorDB' | 'JSONPath';

export type NodeCategory = 'AI & Logic' | 'Database & Tools' | 'Output' | 'All';

export const NODE_CATEGORY_MAP: Record<NodeType, Exclude<NodeCategory, 'All'>> = {
  LLM: 'AI & Logic',
  Prompt: 'AI & Logic',
  Router: 'AI & Logic',
  Tool: 'Database & Tools',
  VectorDB: 'Database & Tools',
  JSONPath: 'Database & Tools',
  Output: 'Output',
};

export const NODE_CATEGORIES: NodeCategory[] = ['All', 'AI & Logic', 'Database & Tools', 'Output'];

export interface NodeData {
  label: string;
  type: NodeType;
  promptTemplate?: string;
  systemPrompt?: string;
  provider?: 'openai' | 'ollama';
  model?: string;
  apiKey?: string;
  endpointUrl?: string;
  toolName?: string;
  routingRules?: string; // Logic for router nodes
  outputVal?: string;
  embeddingModel?: string;
  documents?: string;
  similarityThreshold?: number;
  jsonPath?: string;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
}

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
}

export interface TraceStep {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  output: any;
  log?: string;
  tokensConsumed?: number;
}

export interface RunHistoryEntry {
  id: string;
  timestamp: string;
  nodes: Node[];
  edges: Edge[];
  traceSteps: TraceStep[];
  status: 'success' | 'failure';
}

