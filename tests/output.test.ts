import { describe, it, expect } from 'vitest';
import { Output } from '../src/services/executors/output';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('Output executor', () => {
  it('should correctly pass through a string input', () => {
    const nodeContext = {
      incomingInput: 'test string'
    } as NodeExecutionContext;

    const result = Output(nodeContext);

    expect(result).toEqual({
      nodeOutput: 'test string',
      log: 'Workflow finalized. Final output received: "test string"',
      tokensUsed: 0
    });
  });

  it('should correctly pass through an object input', () => {
    const nodeContext = {
      incomingInput: { key: 'value' }
    } as NodeExecutionContext;

    const result = Output(nodeContext);

    expect(result).toEqual({
      nodeOutput: { key: 'value' },
      log: 'Workflow finalized. Final output received: {"key":"value"}',
      tokensUsed: 0
    });
  });

  it('should correctly pass through a null input', () => {
    const nodeContext = {
      incomingInput: null
    } as NodeExecutionContext;

    const result = Output(nodeContext);

    expect(result).toEqual({
      nodeOutput: null,
      log: 'Workflow finalized. Final output received: null',
      tokensUsed: 0
    });
  });

  it('should correctly pass through an undefined input', () => {
    const nodeContext = {
      incomingInput: undefined
    } as NodeExecutionContext;

    const result = Output(nodeContext);

    expect(result).toEqual({
      nodeOutput: undefined,
      log: 'Workflow finalized. Final output received: undefined',
      tokensUsed: 0
    });
  });
});
