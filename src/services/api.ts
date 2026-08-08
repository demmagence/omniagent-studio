import ipaddr from 'ipaddr.js';
import http from 'http';
import https from 'https';
import dns from 'dns';

export interface LLMResponse {
  text: string;
  tokensUsed: number;
}

function validateIpAddress(ipStr: string, port: string): void {
  let isPrivate = false;
  let isLocal = false;

  if (ipStr === 'localhost') isLocal = true;

  let ipToParse = ipStr;
  if (ipToParse.startsWith('[') && ipToParse.endsWith(']')) {
    ipToParse = ipToParse.slice(1, -1);
  }

  if (ipaddr.isValid(ipToParse)) {
    try {
      let parsedIp = ipaddr.parse(ipToParse);

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

      if (parsedIp.kind() === 'ipv6') {
        const awsIpv6Metadata = ipaddr.parse('fd00:ec2::254') as ipaddr.IPv6;
        if ((parsedIp as ipaddr.IPv6).match(awsIpv6Metadata, 128)) isPrivate = true;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (isPrivate || ipToParse === '169.254.169.254') {
    throw new Error('Access to private network or metadata addresses is forbidden.');
  }

  if (isLocal) {
    const allowedPorts = ['11434', '1234', '8000', '8080'];
    if (!allowedPorts.includes(port)) {
      throw new Error(`Localhost endpoints are restricted to specific ports (e.g., 11434).`);
    }
  }
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
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  const proc = (globalThis as any).process;
  const skipValidation = proc && proc.env && proc.env.NODE_ENV === 'test' && !proc.env.TEST_VALIDATE_ENDPOINT;

  if (!skipValidation) {
    // If it's already an IP or localhost, validate immediately.
    // Otherwise, validation happens at connection time via safeFetch's lookup interceptor.
    if (hostname === 'localhost' || ipaddr.isValid(hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname)) {
      validateIpAddress(hostname, url.port);
    }
  }
}

async function safeFetch(urlStr: string, options: any): Promise<any> {
  const proc = (globalThis as any).process;
  const skipValidation = proc && proc.env && proc.env.NODE_ENV === 'test' && !proc.env.TEST_VALIDATE_ENDPOINT;

  if (skipValidation) {
    return globalThis.fetch(urlStr, options);
  }

  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch (err) {
      return reject(new Error('Invalid URL'));
    }

    let hostname = url.hostname.toLowerCase();
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }

    const requestOptions: any = {
      method: options.method || 'GET',
      headers: options.headers,
      signal: options.signal
    };

    requestOptions.lookup = (lookupHostname: string, dnsOptions: any, callback: any) => {
      dns.lookup(lookupHostname, dnsOptions, (err: NodeJS.ErrnoException | null, address: string, family: number) => {
        if (err) return callback(err);
        try {
          validateIpAddress(address, url.port);
        } catch (validationErr) {
          return callback(validationErr);
        }
        callback(null, address, family);
      });
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, requestOptions, (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        const bodyText = bodyBuffer.toString('utf-8');

        const response = {
          ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => bodyText,
          json: async () => {
            if (!bodyText) return {};
            return JSON.parse(bodyText);
          }
        };
        resolve(response);
      });
    });

    req.on('error', reject);
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy(new Error('AbortError'));
      });
    }

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
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
    const response = await safeFetch(endpoint, {
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
    const response = await safeFetch(endpoint, {
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
