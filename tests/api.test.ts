import { describe, it, expect } from 'vitest';
import { validateEndpointUrl } from '../src/services/api';

describe('validateEndpointUrl', () => {
  it('should allow valid public URLs', () => {
    expect(() => validateEndpointUrl('https://api.openai.com')).not.toThrow();
    expect(() => validateEndpointUrl('http://example.com:80')).not.toThrow();
    expect(() => validateEndpointUrl('https://api.anthropic.com/v1/messages')).not.toThrow();
  });

  it('should allow valid local URLs on allowed ports', () => {
    // IPv4 Loopback
    expect(() => validateEndpointUrl('http://127.0.0.1:11434')).not.toThrow();
    expect(() => validateEndpointUrl('http://127.0.0.1:1234')).not.toThrow();
    expect(() => validateEndpointUrl('http://127.0.0.1:8000')).not.toThrow();
    expect(() => validateEndpointUrl('http://127.0.0.1:8080')).not.toThrow();

    // Localhost
    expect(() => validateEndpointUrl('http://localhost:11434')).not.toThrow();

    // IPv6 Loopback
    expect(() => validateEndpointUrl('http://[::1]:8000')).not.toThrow();
  });

  it('should reject invalid URL formats', () => {
    expect(() => validateEndpointUrl('not-a-url')).toThrow('Invalid endpoint URL format.');
    expect(() => validateEndpointUrl('')).toThrow('Invalid endpoint URL format.');
    expect(() => validateEndpointUrl('http://:80')).toThrow('Invalid endpoint URL format.');
  });

  it('should reject invalid protocols', () => {
    expect(() => validateEndpointUrl('ftp://example.com')).toThrow('Endpoint URL must use http: or https: protocol.');
    expect(() => validateEndpointUrl('ws://localhost:11434')).toThrow('Endpoint URL must use http: or https: protocol.');
    expect(() => validateEndpointUrl('file:///etc/passwd')).toThrow('Endpoint URL must use http: or https: protocol.');
  });

  it('should reject URLs containing credentials', () => {
    expect(() => validateEndpointUrl('http://user:pass@localhost:11434')).toThrow('Endpoint URL must not contain credentials.');
    expect(() => validateEndpointUrl('https://admin@api.example.com')).toThrow('Endpoint URL must not contain credentials.');
  });

  it('should reject forbidden private network addresses', () => {
    const errorMsg = 'Access to private network or metadata addresses is forbidden.';

    // IPv4 Private
    expect(() => validateEndpointUrl('http://10.0.0.1')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://172.16.0.1')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://172.31.255.255')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://192.168.1.1')).toThrow(errorMsg);

    // IPv6 Private
    expect(() => validateEndpointUrl('http://[fc00::1]')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://[fd12:3456:789a:1::1]')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://[fe80::1]')).toThrow(errorMsg);
  });

  it('should reject cloud metadata addresses', () => {
    const errorMsg = 'Access to private network or metadata addresses is forbidden.';
    expect(() => validateEndpointUrl('http://169.254.169.254')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://169.254.169.253')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://[fd00:ec2::254]')).toThrow(errorMsg);
  });

  it('should reject local network addresses with unallowed ports', () => {
    const errorMsg = /Localhost endpoints are restricted to specific ports/;

    // IPv4 Loopback
    expect(() => validateEndpointUrl('http://127.0.0.1:3000')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://127.0.0.1:80')).toThrow(errorMsg);
    expect(() => validateEndpointUrl('http://127.0.0.1')).toThrow(errorMsg); // Default port 80

    // Localhost
    expect(() => validateEndpointUrl('http://localhost:5173')).toThrow(errorMsg);

    // IPv6 Loopback
    expect(() => validateEndpointUrl('http://[::1]:9090')).toThrow(errorMsg);
  });
});
