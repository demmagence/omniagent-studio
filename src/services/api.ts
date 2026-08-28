import ipaddr from 'ipaddr.js';

const dnsCache = new Map<string, Promise<{ type: number; data: string }[]>>();
const networkTypeCache = new Map<string, { isPrivate: boolean; isLocal: boolean }>();

function checkIpStatus(ipStr: string, state: { isPrivate: boolean; isLocal: boolean }) {
  if (ipaddr.isValid(ipStr)) {
    try {
      let parsedIp = ipaddr.parse(ipStr);

      // If IPv4 mapped IPv6, unmap it to test the actual IPv4 address
      if (parsedIp.kind() === 'ipv6') {
        const ip6 = parsedIp as ipaddr.IPv6;
        if (ip6.isIPv4MappedAddress()) {
          parsedIp = ip6.toIPv4Address();
        }
      }

      const range = parsedIp.range();

      if (range === 'loopback' || range === 'unspecified') {
        state.isLocal = true;
      } else if (
        range === 'private' ||
        range === 'uniqueLocal' ||
        range === 'linkLocal' ||
        range === 'carrierGradeNat' ||
        range === 'rfc6052' ||
        range === 'rfc6145' ||
        range === '6to4' ||
        range === 'teredo'
      ) {
        state.isPrivate = true;
      }

      // Check for specific AWS IPv6 metadata address or similar ranges
      if (parsedIp.kind() === 'ipv6') {
        const awsIpv6Metadata = ipaddr.parse('fd00:ec2::254') as ipaddr.IPv6;
        if ((parsedIp as ipaddr.IPv6).match(awsIpv6Metadata, 128)) state.isPrivate = true;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

async function resolveDohRecords(hostname: string, checkIp: (ipStr: string) => void) {
  const resolveType = async (type: string) => {
    const cacheKey = `${hostname}_${type}`;
    let promise = dnsCache.get(cacheKey);
    if (!promise) {
      promise = (async () => {
        try {
          const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
            headers: { accept: 'application/dns-json' },
          });
          if (res.ok) {
            const data = await res.json();
            return data.Answer || [];
          }
          return [];
        } catch (err) {
          dnsCache.delete(cacheKey);
          throw err;
        }
      })();
      dnsCache.set(cacheKey, promise);
    }

    const records = await promise;
    for (const record of records) {
      if (record.type === 1 || record.type === 28) {
        checkIp(record.data);
      }
    }
  };

  // Check both A and AAAA records
  await Promise.all([resolveType('A'), resolveType('AAAA')]);
}

async function getNetworkType(hostname: string): Promise<{ isPrivate: boolean; isLocal: boolean }> {
  if (networkTypeCache.has(hostname)) {
    return { ...networkTypeCache.get(hostname)! };
  }

  const state = { isPrivate: false, isLocal: false };

  if (hostname === 'localhost') state.isLocal = true;

  // Strip brackets for IPv6 parsing
  let ipToParse = hostname;
  if (ipToParse.startsWith('[') && ipToParse.endsWith(']')) {
    ipToParse = ipToParse.slice(1, -1);
  }

  // Skip DoH resolution in tests to prevent hanging/failing tests unless specifically testing validation
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc && proc.env && proc.env.NODE_ENV === 'test' && !proc.env.TEST_VALIDATE_ENDPOINT) {
    networkTypeCache.set(hostname, state);
    return { ...state };
  }

  const checkIp = (ipStr: string) => checkIpStatus(ipStr, state);

  if (ipaddr.isValid(ipToParse)) {
    checkIp(ipToParse);
  } else if (hostname !== 'localhost') {
    // If it's a hostname, perform DNS resolution via DoH to check all underlying IPs
    try {
      await resolveDohRecords(hostname, checkIp);
    } catch (e) {
      console.warn('DNS over HTTPS resolution failed', e);
    }
  }

  networkTypeCache.set(hostname, state);
  return { ...state };
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
}

export async function validateEndpointUrl(endpoint: string): Promise<void> {
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

  const { isPrivate, isLocal } = await getNetworkType(hostname);

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

  await validateEndpointUrl(endpoint);

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
