import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLM } from '../src/services/executors/llm';
import { callLLM } from '../src/services/api';
import { NodeExecutionContext } from '../src/services/executors/types';

vi.mock('../src/services/api', () => ({
  callLLM: vi.fn(),
}));

describe('LLM executor', () => {
  const mockUpdateTraceStep = vi.fn();

  const mockGraphStore = {
    updateTraceStep: mockUpdateTraceStep,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle string input and invoke callLLM with provided options', async () => {
    const mockAbortController = new AbortController();
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: 'Response string from LLM',
      tokensUsed: 42,
    });

    const context: NodeExecutionContext = {
      node: {
        id: 'llm-node-1',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: {
          label: 'LLM Node',
          type: 'LLM',
          provider: 'ollama',
          model: 'llama3',
          systemPrompt: 'You are helpful',
          apiKey: 'key-123',
          endpointUrl: 'http://localhost:11434',
        },
      },
      incomingInput: 'hello world',
      fallback: false,
      abortController: mockAbortController,
      graphStore: mockGraphStore,
    };

    const result = await LLM(context);

    expect(mockUpdateTraceStep).toHaveBeenCalledWith({
      nodeId: 'llm-node-1',
      status: 'running',
      log: 'Calling ollama model: llama3',
    });

    expect(callLLM).toHaveBeenCalledWith(
      'ollama',
      'llama3',
      'hello world',
      {
        systemPrompt: 'You are helpful',
        apiKey: 'key-123',
        endpointUrl: 'http://localhost:11434',
        fallback: false,
        signal: mockAbortController.signal,
      }
    );

    expect(result).toEqual({
      nodeOutput: 'Response string from LLM',
      nodeInput: 'hello world',
      log: 'Calling ollama model: llama3\nReceived LLM response. Tokens used: 42',
      tokensUsed: 42,
    });
  });

  it('should stringify non-string object input', async () => {
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: 'Object response',
      tokensUsed: 15,
    });

    const context: NodeExecutionContext = {
      node: {
        id: 'llm-node-2',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: {
          label: 'LLM Node',
          type: 'LLM',
          provider: 'openai',
          model: 'gpt-4o',
        },
      },
      incomingInput: { query: 'test' },
      fallback: false,
      abortController: new AbortController(),
      graphStore: mockGraphStore,
    };

    const result = await LLM(context);

    expect(result.nodeInput).toBe('{"query":"test"}');
    expect(callLLM).toHaveBeenCalledWith(
      'openai',
      'gpt-4o',
      '{"query":"test"}',
      expect.anything()
    );
  });

  it('should use "Default Prompt" when input is null or undefined', async () => {
    vi.mocked(callLLM).mockResolvedValue({
      text: 'Default response',
      tokensUsed: 5,
    });

    const contextNull: NodeExecutionContext = {
      node: {
        id: 'llm-node-3',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: { label: 'LLM Node', type: 'LLM' },
      },
      incomingInput: null,
      fallback: false,
      abortController: new AbortController(),
      graphStore: mockGraphStore,
    };

    const resultNull = await LLM(contextNull);
    expect(resultNull.nodeInput).toBe('Default Prompt');

    const contextUndefined: NodeExecutionContext = {
      ...contextNull,
      incomingInput: undefined,
    };

    const resultUndefined = await LLM(contextUndefined);
    expect(resultUndefined.nodeInput).toBe('Default Prompt');
  });

  it('should fallback provider to "openai" and model to "default" when omitted in node data', async () => {
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: 'Fallback defaults test',
      tokensUsed: 10,
    });

    const context: NodeExecutionContext = {
      node: {
        id: 'llm-node-4',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: { label: 'LLM Node', type: 'LLM' },
      },
      incomingInput: 'hello',
      fallback: true,
      abortController: new AbortController(),
      graphStore: mockGraphStore,
    };

    await LLM(context);

    expect(mockUpdateTraceStep).toHaveBeenCalledWith({
      nodeId: 'llm-node-4',
      status: 'running',
      log: 'Calling openai model: default',
    });

    expect(callLLM).toHaveBeenCalledWith(
      'openai',
      '',
      'hello',
      expect.objectContaining({
        fallback: true,
      })
    );
  });

  it('should propagate error if callLLM fails', async () => {
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('API Error'));

    const context: NodeExecutionContext = {
      node: {
        id: 'llm-node-5',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: { label: 'LLM Node', type: 'LLM' },
      },
      incomingInput: 'trigger error',
      fallback: false,
      abortController: new AbortController(),
      graphStore: mockGraphStore,
    };

    await expect(LLM(context)).rejects.toThrow('API Error');
  });
});
