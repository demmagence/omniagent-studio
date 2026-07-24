import { NodeExecutionContext, NodeExecutionResult } from './types';

export const Tool = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  const toolName = node.data.toolName || 'calculator';
  let nodeOutput: any;

  if (toolName === 'calculator') {
    const val = typeof incomingInput === 'string' ? incomingInput : String(incomingInput || '');
    const cleanVal = val.includes('Response to:') ? val.split('Response to:')[1] : val;
    const numbers = cleanVal.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const parsedNumbers = numbers.map((n) => Number(n));
      const sum = parsedNumbers.reduce<number>((acc, n) => acc + n, 0);
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
};
