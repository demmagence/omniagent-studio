export interface LLMResponse {
  text: string;
  tokensUsed: number;
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
