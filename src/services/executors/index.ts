import { NodeExecutionContext, NodeExecutionResult } from './types';
import { Prompt } from './prompt';
import { LLM } from './llm';
import { Tool } from './tool';
import { Router } from './router';
import { VectorDB } from './vectorDB';
import { JSONPath } from './jsonPath';
import { Output } from './output';

export const nodeExecutors: Record<string, (context: NodeExecutionContext) => Promise<NodeExecutionResult> | NodeExecutionResult> = {
  Prompt,
  LLM,
  Tool,
  Router,
  VectorDB,
  JSONPath,
  Output
};

export * from './types';
export * from './utils';
