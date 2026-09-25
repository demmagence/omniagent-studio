import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateEndpointUrl, callLLM } from '../src/services/api';

import { vi } from 'vitest';

describe('validateEndpointUrl', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    if (!(globalThis as any).process) (globalThis as any).process = { env: {} };
    (globalThis as any).process.env.TEST_VALIDATE_ENDPOINT = '1';
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('cloudflare-dns')) {
        return { ok: true, json: async () => ({ Answer: [{ type: 1, data: '93.184.216.34' }] }) };
      }
      return originalFetch(url);
    });
  });

  afterAll(() => {
    delete (globalThis as any).process.env.TEST_VALIDATE_ENDPOINT;
    globalThis.fetch = originalFetch;
  });
  it('should allow valid public URLs', async () => {
    await expect(validateEndpointUrl('https://api.openai.com')).resolves.not.toThrow();
    await expect(validateEndpointUrl('http://example.com:80')).resolves.not.toThrow();
    await expect(validateEndpointUrl('https://api.anthropic.com/v1/messages')).resolves.not.toThrow();
  });

  it('should allow valid local URLs on allowed ports', async () => {
    // IPv4 Loopback
    await expect(validateEndpointUrl('http://127.0.0.1:11434')).resolves.not.toThrow();
    await expect(validateEndpointUrl('http://127.0.0.1:1234')).resolves.not.toThrow();
    await expect(validateEndpointUrl('http://127.0.0.1:8000')).resolves.not.toThrow();
    await expect(validateEndpointUrl('http://127.0.0.1:8080')).resolves.not.toThrow();

    // Localhost
    await expect(validateEndpointUrl('http://localhost:11434')).resolves.not.toThrow();

    // IPv6 Loopback
    await expect(validateEndpointUrl('http://[::1]:8000')).resolves.not.toThrow();
  });

  it('should reject invalid URL formats', async () => {
    await expect(validateEndpointUrl('not-a-url')).rejects.toThrow('Invalid endpoint URL format.');
    await expect(validateEndpointUrl('')).rejects.toThrow('Invalid endpoint URL format.');
    await expect(validateEndpointUrl('http://:80')).rejects.toThrow('Invalid endpoint URL format.');
  });

  it('should reject invalid protocols', async () => {
    await expect(validateEndpointUrl('ftp://example.com')).rejects.toThrow('Endpoint URL must use http: or https: protocol.');
    await expect(validateEndpointUrl('ws://localhost:11434')).rejects.toThrow('Endpoint URL must use http: or https: protocol.');
    await expect(validateEndpointUrl('file:///etc/passwd')).rejects.toThrow('Endpoint URL must use http: or https: protocol.');
  });

  it('should reject URLs containing credentials', async () => {
    await expect(validateEndpointUrl('http://user:pass@localhost:11434')).rejects.toThrow('Endpoint URL must not contain credentials.');
    await expect(validateEndpointUrl('https://admin@api.example.com')).rejects.toThrow('Endpoint URL must not contain credentials.');
    await expect(validateEndpointUrl('http://user:pass@example.com')).rejects.toThrow('Endpoint URL must not contain credentials.');
  });

  it('should reject forbidden private network addresses', async () => {
    const errorMsg = 'Access to private network or metadata addresses is forbidden.';

    // IPv4 Private
    await expect(validateEndpointUrl('http://10.0.0.1')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://172.16.0.1')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://172.31.255.255')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://192.168.1.1')).rejects.toThrow(errorMsg);

    // IPv6 Private
    await expect(validateEndpointUrl('http://[fc00::1]')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://[fd12:3456:789a:1::1]')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://[fe80::1]')).rejects.toThrow(errorMsg);
  });

  it('should reject cloud metadata addresses', async () => {
    const errorMsg = 'Access to private network or metadata addresses is forbidden.';
    await expect(validateEndpointUrl('http://169.254.169.254')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://169.254.169.253')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://[fd00:ec2::254]')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://[fd00:0ec2:0000:0000:0000:0000:0000:0254]')).rejects.toThrow(errorMsg);
  });

  it('should reject local network addresses with unallowed ports', async () => {
    const errorMsg = /Localhost endpoints are restricted to specific ports/;

    // IPv4 Loopback
    await expect(validateEndpointUrl('http://127.0.0.1:3000')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://127.0.0.1:80')).rejects.toThrow(errorMsg);
    await expect(validateEndpointUrl('http://127.0.0.1')).rejects.toThrow(errorMsg); // Default port 80

    // Localhost
    await expect(validateEndpointUrl('http://localhost:5173')).rejects.toThrow(errorMsg);

    // IPv6 Loopback
    await expect(validateEndpointUrl('http://[::1]:9090')).rejects.toThrow(errorMsg);
  });

  it('should reject SSRF bypass attempts using alternate IP encodings', async () => {
    const errorMsgPrivate = 'Access to private network or metadata addresses is forbidden.';
    const errorMsgLocal = /Localhost endpoints are restricted to specific ports/;

    // Localhost bypasses (targeting port 80)
    await expect(validateEndpointUrl('http://0177.0.0.1')).rejects.toThrow(errorMsgLocal); // Octal 127.0.0.1
    await expect(validateEndpointUrl('http://0x7f.0.0.1')).rejects.toThrow(errorMsgLocal); // Hex 127.0.0.1
    await expect(validateEndpointUrl('http://2130706433')).rejects.toThrow(errorMsgLocal); // Decimal integer 127.0.0.1
    await expect(validateEndpointUrl('http://127.1')).rejects.toThrow(errorMsgLocal); // Shortened 127.0.0.1

    // IPv4-mapped IPv6 pointing to localhost
    await expect(validateEndpointUrl('http://[::ffff:127.0.0.1]')).rejects.toThrow(errorMsgLocal);

    // Cloud metadata bypasses (targeting 169.254.169.254)
    await expect(validateEndpointUrl('http://2852039166')).rejects.toThrow(errorMsgPrivate); // Integer 169.254.169.254
    await expect(validateEndpointUrl('http://0251.0376.0251.0376')).rejects.toThrow(errorMsgPrivate); // Octal
    await expect(validateEndpointUrl('http://0xa9fea9fe')).rejects.toThrow(errorMsgPrivate); // Hex
    await expect(validateEndpointUrl('http://0xa9.0xfe.0xa9.0xfe')).rejects.toThrow(errorMsgPrivate); // Dotted Hex

    // IPv4-mapped IPv6 pointing to metadata
    await expect(validateEndpointUrl('http://[::ffff:169.254.169.254]')).rejects.toThrow(errorMsgPrivate);
  });
});

describe('callLLM', () => {
  it('should propagate URL validation error when invalid endpoint URL format is provided', async () => {
    await expect(
      callLLM('openai', 'gpt-4o-mini', 'hello', { endpointUrl: 'invalid-url', fallback: false })
    ).rejects.toThrow('Invalid endpoint URL format.');

    await expect(
      callLLM('ollama', 'llama3', 'hello', { endpointUrl: 'invalid-url', fallback: false })
    ).rejects.toThrow('Invalid endpoint URL format.');
  });

  it('should propagate URL validation error for forbidden private endpoint URLs', async () => {
    await expect(
      callLLM('openai', 'gpt-4o-mini', 'hello', { endpointUrl: 'http://10.0.0.1', fallback: false })
    ).rejects.toThrow('Access to private network or metadata addresses is forbidden.');
  });

  it('should handle fallback option with and without system prompt', async () => {
    const resWithoutSystem = await callLLM('openai', 'gpt-4o-mini', 'Test prompt', { fallback: true });
    expect(resWithoutSystem.text).toBe('[Simulated openai - Model: gpt-4o-mini] Response to: "Test prompt"');
    expect(resWithoutSystem.tokensUsed).toBe(Math.ceil('Test prompt'.length / 4) + 15);

    const resWithSystem = await callLLM('ollama', 'llama3', 'Test prompt', {
      fallback: true,
      systemPrompt: 'Be concise',
    });
    expect(resWithSystem.text).toBe(
      'System directive: Be concise\n\n[Simulated ollama - Model: llama3] Response to: "Test prompt"'
    );
  });

  it('should throw error when OpenAI API returns non-ok HTTP status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      callLLM('openai', 'gpt-4o', 'Hello', { apiKey: 'invalid-key' })
    ).rejects.toThrow('OpenAI API failed with status 401: Unauthorized');

    vi.unstubAllGlobals();
  });

  it('should throw error when Ollama API returns non-ok HTTP status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      callLLM('ollama', 'llama3', 'Hello', { endpointUrl: 'http://localhost:11434/api/generate' })
    ).rejects.toThrow('Ollama API failed with status 500: Internal Error');

    vi.unstubAllGlobals();
  });

  it('should successfully return parsed response and default empty fallbacks for OpenAI', async () => {
    // Test normal response
    let mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello human' } }],
        usage: { total_tokens: 25 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await callLLM('openai', 'gpt-4o', 'Hi', { apiKey: 'key-123' });
    expect(result).toEqual({ text: 'Hello human', tokensUsed: 25 });

    // Test response missing choices and usage
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultEmpty = await callLLM('openai', '', 'Hi');
    expect(resultEmpty).toEqual({ text: '', tokensUsed: 0 });

    vi.unstubAllGlobals();
  });

  it('should successfully return parsed response and default empty fallbacks for Ollama', async () => {
    // Test normal response
    let mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Ollama answer',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await callLLM('ollama', 'llama3', 'Hello Ollama', {
      endpointUrl: 'http://localhost:11434/api/generate',
      systemPrompt: 'Sys prompt',
    });
    expect(result.text).toBe('Ollama answer');
    expect(result.tokensUsed).toBe(Math.ceil(('Ollama answer'.length + 'Hello Ollama'.length) / 4));

    // Test response missing response field
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultEmpty = await callLLM('ollama', '', 'Hi');
    expect(resultEmpty.text).toBe('');
    expect(resultEmpty.tokensUsed).toBe(Math.ceil('Hi'.length / 4));

    vi.unstubAllGlobals();
  });
});
