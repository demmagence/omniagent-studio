import { NodeExecutionContext, NodeExecutionResult } from './types';

export const Router = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
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
};
