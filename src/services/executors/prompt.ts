import { NodeExecutionContext, NodeExecutionResult } from './types';

export const Prompt = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
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
};
