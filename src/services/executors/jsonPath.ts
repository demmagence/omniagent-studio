import { NodeExecutionContext, NodeExecutionResult } from './types';

export const JSONPath = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  let parsedInput: unknown = incomingInput;
  if (typeof incomingInput === 'string') {
    try {
      parsedInput = JSON.parse(incomingInput);
    } catch (e) {
      return { nodeOutput: null, error: 'Invalid JSON input', log: 'Invalid JSON input', tokensUsed: 0 };
    }
  }

  const rawPath = node.data.jsonPath || '';
  const path = rawPath.replace(/^\$/, '');
  const cleanPath = path
    .replace(/\[\s*['"]?([^'"]+?)['"]?\s*\]/g, '.$1')
    .replace(/^\./, '');

  let current: unknown = parsedInput;
  if (cleanPath) {
    const keys = cleanPath.split('.').filter(Boolean);
    for (const key of keys) {
      if (current === null || current === undefined) {
        current = undefined;
        break;
      }
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        current = undefined;
        break;
      }
      if (Array.isArray(current)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) {
          current = current[idx];
          continue;
        }
      }
      current = typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[key] : undefined;
    }
  }

  return {
    nodeOutput: current,
    log: `Extracting path '${rawPath}' from input`,
    tokensUsed: 0
  };
};
