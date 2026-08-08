import { NodeExecutionContext, NodeExecutionResult } from './types';

export const JSONPath = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  let parsedInput: any = incomingInput;
  if (typeof incomingInput === 'string') {
    try {
      parsedInput = JSON.parse(incomingInput);
    } catch (e) {
      // Keep as is
    }
  }

  const rawPath = node.data.jsonPath || '';
  const path = rawPath.replace(/^\$/, '');
  const cleanPath = path
    .replace(/\[\s*['"]?([^'"]+?)['"]?\s*\]/g, '.$1')
    .replace(/^\./, '');

  let current = parsedInput;
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

      let nextValue = undefined;

      if (Array.isArray(current)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx) && String(idx) === key) {
          nextValue = current[idx];
        } else if (key === 'length') {
          nextValue = current.length;
        }
      } else if (typeof current === 'object' || typeof current === 'string') {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          nextValue = (current as any)[key];
        }
      }

      current = nextValue;
    }
  }

  return {
    nodeOutput: current,
    log: `Extracting path '${rawPath}' from input`,
    tokensUsed: 0
  };
};
