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
    .map((doc: string) => {
      const docFreq = getWordFrequency(doc);
      const similarity = calculateCosineSimilarity(queryFreq, docFreq);
      return { doc, similarity };
    })
    .filter((item: { doc: string, similarity: number }) => item.similarity >= threshold)
    .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
    .map((item: { doc: string }) => item.doc);

  log += `. Found ${matches.length} matching documents.`;

  return {
    nodeOutput: matches,
    nodeInput: queryStr,
    log,
    tokensUsed: 0
  };
};
