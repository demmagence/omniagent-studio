import { NodeExecutionContext, NodeExecutionResult } from './types';

const DOLLAR_SIGN_REGEX = /^\$/;
const BRACKET_NOTATION_REGEX = /\[\s*['"]?([^'"]+?)['"]?\s*\]/g;
const LEADING_DOT_REGEX = /^\./;

export const JSONPath = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  let parsedInput: unknown = incomingInput;
  if (typeof incomingInput === 'string') {
    try {
      parsedInput = JSON.parse(incomingInput);
    } catch (e) {
      // Keep as is
    }
  }

  const rawPath = node.data.jsonPath || '';
  const path = rawPath.replace(DOLLAR_SIGN_REGEX, '');
  const cleanPath = path
    .replace(BRACKET_NOTATION_REGEX, '.$1')
    .replace(LEADING_DOT_REGEX, '');

  let current: unknown = parsedInput;
  if (cleanPath) {
    const keys = cleanPath.split('.').filter(Boolean);
    for (const key of keys) {
      if (current === null || current === undefined) {
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
      if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, key)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }
  }

  return {
    nodeOutput: current,
    log: `Extracting path '${rawPath}' from input`,
    tokensUsed: 0
  };
};
