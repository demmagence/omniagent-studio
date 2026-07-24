import { NodeExecutionContext, NodeExecutionResult } from './types';

export const Output = ({ incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  return {
    nodeOutput: incomingInput,
    log: `Workflow finalized. Final output received: ${JSON.stringify(incomingInput)}`,
    tokensUsed: 0
  };
};
