import { describe, it, expect } from 'vitest';
import { Prompt } from '../src/services/executors/prompt';
import { NodeExecutionContext } from '../src/services/executors/types';

describe('Prompt executor', () => {
  it('should replace {input} with string input', () => {
    const context = {
      node: { data: { promptTemplate: 'Hello {input}' } },
      incomingInput: 'world',
    } as any as NodeExecutionContext;

    const result = Prompt(context);
    expect(result.nodeOutput).toBe('Hello world');
    expect(result.log).toBe('Generating prompt from template: Hello {input}');
    expect(result.tokensUsed).toBe(0);
  });

  it('should handle case-insensitive global replacement', () => {
    const context = {
      node: { data: { promptTemplate: '{InPuT} and {INPUT}' } },
      incomingInput: 'test',
    } as any as NodeExecutionContext;

    const result = Prompt(context);
    expect(result.nodeOutput).toBe('test and test');
  });

  it('should stringify object input', () => {
    const context = {
      node: { data: { promptTemplate: 'Data: {input}' } },
      incomingInput: { id: 1 },
    } as any as NodeExecutionContext;

    const result = Prompt(context);
    expect(result.nodeOutput).toBe('Data: {"id":1}');
  });

  it('should handle empty template with null input', () => {
    const context = {
      node: { data: {} },
      incomingInput: null,
    } as any as NodeExecutionContext;

    const result = Prompt(context);
    expect(result.nodeOutput).toBe('');
    expect(result.log).toBe('Generating prompt from template: ');
  });

  it('should return original template if no {input} placeholder exists', () => {
    const context = {
      node: { data: { promptTemplate: 'No placeholder' } },
      incomingInput: 'ignored',
    } as any as NodeExecutionContext;

    const result = Prompt(context);
    expect(result.nodeOutput).toBe('No placeholder');
  });
});
