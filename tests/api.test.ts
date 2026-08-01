import { describe, it, expect } from 'vitest';
import { validateEndpointUrl } from '../src/services/api';

import { vi } from 'vitest';

describe('validateEndpointUrl', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    process.env.TEST_VALIDATE_ENDPOINT = '1';
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('cloudflare-dns')) {
        return { ok: true, json: async () => ({ Answer: [{ type: 1, data: '93.184.216.34' }] }) };
      }
      return originalFetch(url);
    });
  });

  afterAll(() => {
    delete process.env.TEST_VALIDATE_ENDPOINT;
    global.fetch = originalFetch;
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
