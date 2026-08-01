import ipaddr from 'ipaddr.js';

function getNetworkType(hostname: string): { isPrivate: boolean; isLocal: boolean } {
  let isPrivate = false;
  let isLocal = false;

  if (hostname === 'localhost') isLocal = true;

  // Strip brackets for IPv6 parsing
  let ipToParse = hostname;
  if (ipToParse.startsWith('[') && ipToParse.endsWith(']')) {
    ipToParse = ipToParse.slice(1, -1);
  }

  if (ipaddr.isValid(ipToParse)) {
    try {
      let parsedIp = ipaddr.parse(ipToParse);

      // If IPv4 mapped IPv6, unmap it to test the actual IPv4 address
      if (parsedIp.kind() === 'ipv6') {
        const ip6 = parsedIp as ipaddr.IPv6;
        if (ip6.isIPv4MappedAddress()) {
          parsedIp = ip6.toIPv4Address();
        }
      }

      const range = parsedIp.range();

      if (range === 'loopback' || range === 'unspecified') {
        isLocal = true;
      } else if (
        range === 'private' ||
        range === 'uniqueLocal' ||
        range === 'linkLocal'
      ) {
        isPrivate = true;
      }

      // Check for specific AWS IPv6 metadata address or similar ranges
      if (parsedIp.kind() === 'ipv6') {
        const ip6Str = parsedIp.toNormalizedString();
        if (ip6Str === 'fd00:ec2::254') isPrivate = true;
      }

    } catch (e) {
      // Ignore parse errors, just means it's not a valid IP and will rely on DNS
      console.debug('Failed to parse as IP, treating as hostname.', e);
    }
  }

  return { isPrivate, isLocal };
}

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

  const { isPrivate, isLocal } = getNetworkType(hostname);

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
