import { NodeExecutionContext, NodeExecutionResult } from './types';
import { callLLM } from '../api';

export const LLM = async ({ node, incomingInput, fallback, abortController, graphStore }: NodeExecutionContext): Promise<NodeExecutionResult> => {
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
};
