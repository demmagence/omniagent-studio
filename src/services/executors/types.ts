import { Node } from '../../types';
import { graphStore } from '../../store/graphStore';

export interface ExecutionOptions {
  timeoutMs?: number;
  fallback?: boolean;
  maxConcurrency?: number;
}

export interface NodeExecutionResult {
  nodeOutput: unknown;
  log: string;
  tokensUsed: number;
  nodeInput?: unknown;
}

export interface NodeExecutionContext {
  node: Node;
  incomingInput: unknown;
  fallback: boolean;
  abortController: AbortController;
  graphStore: typeof graphStore;
}
