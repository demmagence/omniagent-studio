import { graphStore } from '../store/graphStore';
import { getTopologicalOrder, hasCycle } from '../utils/graphUtils';
import { callLLM } from './api';
import { Node, TraceStep } from '../types';

export interface ExecutionOptions {
  timeoutMs?: number;
  fallback?: boolean;
}

export async function executeWorkflow(options: ExecutionOptions = {}): Promise<TraceStep[]> {
  const { nodes, edges, isFallbackMode } = graphStore.getState();
  const fallback = options.fallback !== undefined ? options.fallback : isFallbackMode;
  const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 30000;

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
    throw new Error(errorMsg);
  }

  const order = getTopologicalOrder(nodes, edges);
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

  const runPromise = (async () => {
    const startTime = Date.now();
    for (const nodeId of order) {
      if (Date.now() - startTime >= timeoutMs || timeoutMs === 0) {
        throw new Error(`Workflow execution timed out after ${timeoutMs}ms`);
      }
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      graphStore.updateTraceStep({
        nodeId,
        status: 'running',
        log: `Starting execution of ${node.data.label}`,
      });

      try {
        const incomingInput = getIncomingInputs(nodeId);
        let nodeInput = incomingInput;
        let nodeOutput: any = null;
        let tokensUsed = 0;
        let log = '';

        switch (node.type) {
          case 'Prompt': {
            const template = node.data.promptTemplate || '';
            log = `Generating prompt from template: ${template}`;
            let rendered = template;
            if (incomingInput !== null && incomingInput !== undefined) {
              const inputStr = typeof incomingInput === 'object' 
                ? JSON.stringify(incomingInput) 
                : String(incomingInput);
              rendered = template.replace(/\{input\}/gi, inputStr);
            }
            nodeOutput = rendered;
            break;
          }

          case 'LLM': {
            const prompt = typeof incomingInput === 'string' 
              ? incomingInput 
              : incomingInput !== null && incomingInput !== undefined
                ? JSON.stringify(incomingInput) 
                : 'Default Prompt';
            
            nodeInput = prompt;
            log = `Calling ${node.data.provider || 'openai'} model: ${node.data.model || 'default'}`;

            const response = await callLLM(
              node.data.provider || 'openai',
              node.data.model || '',
              prompt,
              {
                systemPrompt: node.data.systemPrompt,
                apiKey: node.data.apiKey,
                endpointUrl: node.data.endpointUrl,
                fallback
              }
            );

            nodeOutput = response.text;
            tokensUsed = response.tokensUsed;
            log = `Received LLM response. Tokens used: ${tokensUsed}`;
            break;
          }

          case 'Tool': {
            const toolName = node.data.toolName || 'calculator';
            log = `Executing tool: ${toolName}`;
            
            if (toolName === 'calculator') {
              const val = typeof incomingInput === 'string' ? incomingInput : String(incomingInput || '');
              const cleanVal = val.includes('Response to:') ? val.split('Response to:')[1] : val;
              const numbers = cleanVal.match(/\d+/g);
              if (numbers && numbers.length >= 2) {
                const sum = numbers.reduce((a, b) => Number(a) + Number(b), 0);
                nodeOutput = `Result: ${sum}`;
              } else {
                nodeOutput = `Processed: Length = ${val.length}`;
              }
            } else if (toolName === 'webSearch') {
              nodeOutput = `[Web Search results for: ${JSON.stringify(incomingInput)}] Found AI agent documents.`;
            } else {
              nodeOutput = `Tool ${toolName} executed successfully with inputs: ${JSON.stringify(incomingInput)}`;
            }
            break;
          }

          case 'Router': {
            const inputVal = typeof incomingInput === 'string' ? incomingInput : JSON.stringify(incomingInput || '');
            const rules = node.data.routingRules || '';
            log = `Routing input based on rules: ${rules}`;
            
            if (rules && inputVal) {
              const lowerInput = inputVal.toLowerCase();
              if (lowerInput.includes('error') || lowerInput.includes('fail')) {
                nodeOutput = 'Error Branch';
              } else if (lowerInput.includes('tool') || lowerInput.includes('search')) {
                nodeOutput = 'Tool Branch';
              } else {
                nodeOutput = 'Default Route';
              }
            } else {
              nodeOutput = 'Default Route';
            }
            break;
          }

          case 'Output': {
            nodeOutput = incomingInput;
            log = `Workflow finalized. Final output received: ${JSON.stringify(nodeOutput)}`;
            break;
          }

          default:
            throw new Error(`Unknown node type: ${node.type}`);
        }

        outputs.set(nodeId, nodeOutput);
        graphStore.updateTraceStep({
          nodeId,
          status: 'completed',
          input: nodeInput,
          output: nodeOutput,
          log,
          tokensConsumed: tokensUsed,
        });

      } catch (nodeErr) {
        const errMsg = nodeErr instanceof Error ? nodeErr.message : String(nodeErr);
        graphStore.updateTraceStep({
          nodeId,
          status: 'failed',
          log: `Error executing node: ${errMsg}`,
        });
        throw nodeErr;
      }
    }
    return graphStore.getState().traceSteps;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Workflow execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([runPromise, timeoutPromise]);
    graphStore.setIsRunning(false);
    return result;
  } catch (error) {
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
    throw error;
  }
}
