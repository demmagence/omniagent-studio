import { Node } from '../../types';
import { graphStore } from '../../store/graphStore';

export interface ExecutionOptions {
  timeoutMs?: number;
  fallback?: boolean;
  maxConcurrency?: number;
}

export interface NodeExecutionResult {
  nodeOutput: any;
  log: string;
  tokensUsed: number;
  nodeInput?: any;
}

export interface NodeExecutionContext {
  node: Node;
  incomingInput: any;
  fallback: boolean;
  abortController: AbortController;
  graphStore: typeof graphStore;
}
