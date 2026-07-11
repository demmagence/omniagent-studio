export interface LLMResponse {
  text: string;
  tokensUsed: number;
}

export function validateEndpointUrl(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (err) {
    throw new Error('Invalid endpoint URL format.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Endpoint URL must use http: or https: protocol.');
  }

  if (url.username || url.password) {
    throw new Error('Endpoint URL must not contain credentials.');
  }

  let hostname = url.hostname.toLowerCase();

  // Strip trailing dot to prevent bypasses like `localhost.`
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  let isPrivate = false;
  let isLocal = false;

  // Note: Since this is a client-side execution environment (browser), synchronous
  // DNS resolution is not possible before the fetch call. We rely on string/regex
  // validation for explicit IP addresses, and depend on the browser's
  // Private Network Access (PNA) checks and CORS policies to mitigate DNS rebinding
  // and custom domains resolving to local network IPs.

  // 1. Check IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);
    if (p1 === 10) isPrivate = true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) isPrivate = true;
    if (p1 === 192 && p2 === 168) isPrivate = true;
    if (p1 === 169 && p2 === 254) isPrivate = true; // Cloud Metadata
    if (p1 === 127 || p1 === 0) isLocal = true;
  }

  if (hostname === 'localhost') isLocal = true;

  // 2. Check IPv6
  if (hostname.includes(':')) {
    const ip6 = hostname.replace('[', '').replace(']', '');
    if (ip6 === '::1' || ip6 === '::' || ip6 === '0:0:0:0:0:0:0:1') isLocal = true;
    if (ip6.startsWith('fc') || ip6.startsWith('fd')) isPrivate = true;
    if (ip6.startsWith('fe8') || ip6.startsWith('fe9') || ip6.startsWith('fea') || ip6.startsWith('feb')) isPrivate = true;

    // AWS IPv6 metadata
    if (ip6 === 'fd00:ec2::254') isPrivate = true;

    // Catch IPv4-mapped IPv6 that have been normalized to hex by URL constructor
    // e.g., [::ffff:169.254.169.254] -> ::ffff:a9fe:a9fe
    // e.g., [::127.0.0.1] -> ::7f00:1
    if (ip6.includes('a9fe:a9fe')) isPrivate = true;
    if (ip6.startsWith('::ffff:7f') || ip6.startsWith('::7f')) isLocal = true;
  }

  // Disallow explicit metadata/private IPs
  if (isPrivate || hostname === '169.254.169.254') {
    throw new Error('Access to private network or metadata addresses is forbidden.');
  }

  // Prevent arbitrary local loopback access, allow only specific AI inference ports
  if (isLocal) {
    const allowedPorts = ['11434', '1234', '8000', '8080'];
    if (!allowedPorts.includes(url.port)) {
      throw new Error(`Localhost endpoints are restricted to specific ports (e.g., 11434).`);
    }
  }
}

export async function callLLM(
  provider: 'openai' | 'ollama',
  model: string,
  prompt: string,
  options: {
    systemPrompt?: string;
    apiKey?: string;
    endpointUrl?: string;
    fallback?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<LLMResponse> {
  if (options.fallback) {
    const tokens = Math.ceil(prompt.length / 4) + 15;
    let text = `[Simulated ${provider} - Model: ${model}] Response to: "${prompt}"`;
    if (options.systemPrompt) {
      text = `System directive: ${options.systemPrompt}\n\n${text}`;
    }
    return { text, tokensUsed: tokens };
  }

  const endpoint = options.endpointUrl || 
    (provider === 'openai' 
      ? 'https://api.openai.com/v1/chat/completions' 
      : 'http://localhost:11434/api/generate');

  validateEndpointUrl(endpoint);

  if (provider === 'openai') {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey || ''}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API failed with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    return { text, tokensUsed };
  } else {
    // Ollama
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama3',
        prompt: prompt,
        system: options.systemPrompt,
        stream: false,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API failed with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.response || '';
    const tokensUsed = Math.ceil((text.length + prompt.length) / 4);
    return { text, tokensUsed };
  }
}
