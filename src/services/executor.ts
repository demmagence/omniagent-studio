import { graphStore } from '../store/graphStore';
import { hasCycle } from '../utils/graphUtils';
import { callLLM } from './api';
import { Node, TraceStep } from '../types';

export function getWordFrequency(text: string): Map<string, number> {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

export function calculateCosineSimilarity(freq1: Map<string, number>, freq2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const [word, count] of freq1.entries()) {
    norm1 += count * count;
    if (freq2.has(word)) {
      dotProduct += count * (freq2.get(word) || 0);
    }
  }

  for (const count of freq2.values()) {
    norm2 += count * count;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

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

const nodeExecutors: Record<string, (context: NodeExecutionContext) => Promise<NodeExecutionResult> | NodeExecutionResult> = {
  Prompt: ({ node, incomingInput }) => {
    const template = node.data.promptTemplate || '';
    let rendered = template;
    if (incomingInput !== null && incomingInput !== undefined) {
      const inputStr = typeof incomingInput === 'object'
        ? JSON.stringify(incomingInput)
        : String(incomingInput);
      rendered = template.replace(/\{input\}/gi, inputStr);
    }
    return {
      nodeOutput: rendered,
      log: `Generating prompt from template: ${template}`,
      tokensUsed: 0
    };
  },

  LLM: async ({ node, incomingInput, fallback, abortController, graphStore }) => {
    const prompt = typeof incomingInput === 'string'
      ? incomingInput
      : incomingInput !== null && incomingInput !== undefined
        ? JSON.stringify(incomingInput)
        : 'Default Prompt';

    const callLog = `Calling ${node.data.provider || 'openai'} model: ${node.data.model || 'default'}`;
    graphStore.updateTraceStep({
      nodeId: node.id,
      status: 'running',
      log: callLog,
    });

    const response = await callLLM(
      node.data.provider || 'openai',
      node.data.model || '',
      prompt,
      {
        systemPrompt: node.data.systemPrompt,
        apiKey: node.data.apiKey,
        endpointUrl: node.data.endpointUrl,
        fallback,
        signal: abortController.signal
      }
    );

    return {
      nodeOutput: response.text,
      nodeInput: prompt,
      log: `${callLog}\nReceived LLM response. Tokens used: ${response.tokensUsed}`,
      tokensUsed: response.tokensUsed
    };
  },

  Tool: ({ node, incomingInput }) => {
    const toolName = node.data.toolName || 'calculator';
    let nodeOutput: any;

    if (toolName === 'calculator') {
      const val = typeof incomingInput === 'string' ? incomingInput : String(incomingInput || '');
      const cleanVal = val.includes('Response to:') ? val.split('Response to:')[1] : val;
      const numbers = cleanVal.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const sum = numbers.reduce((a, b) => a + Number(b), 0);
        nodeOutput = `Result: ${sum}`;
      } else {
        nodeOutput = `Processed: Length = ${val.length}`;
      }
    } else if (toolName === 'webSearch') {
      nodeOutput = `[Web Search results for: ${JSON.stringify(incomingInput)}] Found AI agent documents.`;
    } else {
      nodeOutput = `Tool ${toolName} executed successfully with inputs: ${JSON.stringify(incomingInput)}`;
    }

    return {
      nodeOutput,
      log: `Executing tool: ${toolName}`,
      tokensUsed: 0
    };
  },

  Router: ({ node, incomingInput }) => {
    const inputVal = typeof incomingInput === 'string' ? incomingInput : JSON.stringify(incomingInput || '');
    const rules = node.data.routingRules || '';
    let nodeOutput = 'Default Route';

    if (rules && inputVal) {
      const lowerInput = inputVal.toLowerCase();
      if (lowerInput.includes('error') || lowerInput.includes('fail')) {
        nodeOutput = 'Error Branch';
      } else if (lowerInput.includes('tool') || lowerInput.includes('search')) {
        nodeOutput = 'Tool Branch';
      }
    }

    return {
      nodeOutput,
      log: `Routing input based on rules: ${rules}`,
      tokensUsed: 0
    };
  },

  VectorDB: ({ node, incomingInput }) => {
    const queryStr = typeof incomingInput === 'string'
      ? incomingInput
      : incomingInput !== null && incomingInput !== undefined
        ? JSON.stringify(incomingInput)
        : '';

    const model = node.data.embeddingModel || 'default';
    const docs = (node.data.documents || '')
      .split('\n')
      .map((d: string) => d.trim())
      .filter(Boolean);

    const threshold = node.data.similarityThreshold !== undefined
      ? node.data.similarityThreshold
      : 0;

    let log = `Running VectorDB query on ${docs.length} documents using model: ${model} with threshold ${threshold}`;

    const queryFreq = getWordFrequency(queryStr);
    const matches = docs
      .map((doc: string) => {
        const docFreq = getWordFrequency(doc);
        const similarity = calculateCosineSimilarity(queryFreq, docFreq);
        return { doc, similarity };
      })
      .filter((item: { doc: string, similarity: number }) => item.similarity >= threshold)
      .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
      .map((item: { doc: string }) => item.doc);

    log += `. Found ${matches.length} matching documents.`;

    return {
      nodeOutput: matches,
      nodeInput: queryStr,
      log,
      tokensUsed: 0
    };
  },

  JSONPath: ({ node, incomingInput }) => {
    let parsedInput: any = incomingInput;
    if (typeof incomingInput === 'string') {
      try {
        parsedInput = JSON.parse(incomingInput);
      } catch (e) {
        // Keep as is
      }
    }

    const rawPath = node.data.jsonPath || '';
    const path = rawPath.replace(/^\$/, '');
    const cleanPath = path
      .replace(/\[\s*['"]?([^'"]+?)['"]?\s*\]/g, '.$1')
      .replace(/^\./, '');

    let current = parsedInput;
    if (cleanPath) {
      const keys = cleanPath.split('.').filter(Boolean);
      for (const key of keys) {
        if (current === null || current === undefined) {
          current = undefined;
          break;
        }
        if (Array.isArray(current)) {
          const idx = parseInt(key, 10);
          if (!isNaN(idx)) {
            current = current[idx];
            continue;
          }
        }
        current = current[key];
      }
    }

    return {
      nodeOutput: current,
      log: `Extracting path '${rawPath}' from input`,
      tokensUsed: 0
    };
  },

  Output: ({ incomingInput }) => {
    return {
      nodeOutput: incomingInput,
      log: `Workflow finalized. Final output received: ${JSON.stringify(incomingInput)}`,
      tokensUsed: 0
    };
  }
};

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

  const getIncomingInputs = (targetId: string) => {
    const incomingEdges = edges.filter(e => e.target === targetId);
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
        const incomingEdges = edges.filter(e => e.target === node.id);
        return incomingEdges.every(e => completedNodes.has(e.source));
      });

      if (readyNodes.length === 0 && runningNodes.size === 0) {
        resolve(graphStore.getState().traceSteps);
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

      await new Promise(r => setTimeout(r, 5));
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
