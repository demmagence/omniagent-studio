import { NodeExecutionContext, NodeExecutionResult } from './types';
import { getWordFrequency, calculateCosineSimilarity } from './utils';

export const VectorDB = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  const queryStr = typeof incomingInput === 'string'
    ? incomingInput
    : incomingInput !== null && incomingInput !== undefined
      ? JSON.stringify(incomingInput)
      : '';

  const model = node.data.embeddingModel || 'default';
  const docs = (node.data.documents || '')
    .split('\n')
    .map((d: string) => d.trim())
    .filter(Boolean);

  const threshold = node.data.similarityThreshold !== undefined
    ? node.data.similarityThreshold
    : 0;

  let log = `Running VectorDB query on ${docs.length} documents using model: ${model} with threshold ${threshold}`;

  const queryFreq = getWordFrequency(queryStr);
  const matches = docs
    .reduce((acc: { doc: string; similarity: number }[], doc: string) => {
      const docFreq = getWordFrequency(doc);
      const similarity = calculateCosineSimilarity(queryFreq, docFreq);
      if (similarity >= threshold) {
        acc.push({ doc, similarity });
      }
      return acc;
    }, [])
    .sort((a, b) => b.similarity - a.similarity)
    .map(item => item.doc);

  log += `. Found ${matches.length} matching documents.`;

  return {
    nodeOutput: matches,
    nodeInput: queryStr,
    log,
    tokensUsed: 0
  };
};
