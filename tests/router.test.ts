import { describe, it, expect } from 'vitest';
import { Router } from '../src/services/executors/router';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('Router executor', () => {
  const createMockContext = (incomingInput: any, routingRules?: string) => {
    return {
      node: {
        data: {
          routingRules: routingRules !== undefined ? routingRules : 'some-rules',
        },
      },
      incomingInput,
    } as any as NodeExecutionContext;
  };

  it('should route to Error Branch if input includes "error"', () => {
    const result = Router(createMockContext('this is an error message'));
    expect(result.nodeOutput).toBe('Error Branch');
  });

  it('should route to Error Branch if stringified input includes "fail"', () => {
    const result = Router(createMockContext({ status: 'fail' }));
    expect(result.nodeOutput).toBe('Error Branch');
  });

  it('should route to Tool Branch if input includes "tool"', () => {
    const result = Router(createMockContext('run this tool'));
    expect(result.nodeOutput).toBe('Tool Branch');
  });

  it('should route to Tool Branch if input includes "search"', () => {
    const result = Router(createMockContext('search for query'));
    expect(result.nodeOutput).toBe('Tool Branch');
  });

  it('should fall back to Default Route if input does not match any condition', () => {
    const result = Router(createMockContext('hello world'));
    expect(result.nodeOutput).toBe('Default Route');
  });

  it('should handle case insensitivity', () => {
    const resultError = Router(createMockContext('ERROR'));
    expect(resultError.nodeOutput).toBe('Error Branch');

    const resultTool = Router(createMockContext('ToOl'));
    expect(resultTool.nodeOutput).toBe('Tool Branch');
  });

  it('should return Default Route if routingRules is missing or empty', () => {
    const resultEmptyRules = Router(createMockContext('error', ''));
    expect(resultEmptyRules.nodeOutput).toBe('Default Route');

    const resultNoRules = Router({ node: { data: {} }, incomingInput: 'error' } as any as NodeExecutionContext);
    expect(resultNoRules.nodeOutput).toBe('Default Route');
  });

  it('should handle missing incomingInput gracefully', () => {
    const result = Router(createMockContext(undefined));
    expect(result.nodeOutput).toBe('Default Route');
  });

  it('should format log string properly', () => {
    const result = Router(createMockContext('hello', 'my-rules'));
    expect(result.log).toBe('Routing input based on rules: my-rules');
  });

  it('should set tokensUsed to 0', () => {
    const result = Router(createMockContext('hello'));
    expect(result.tokensUsed).toBe(0);
  });
});
