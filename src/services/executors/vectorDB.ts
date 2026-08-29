import { NodeExecutionContext, NodeExecutionResult } from './types';
import { getWordFrequency, calculateCosineSimilarity } from './utils';

const docFreqCache = new Map<string, Map<string, number>>();
const CACHE_LIMIT = 5000;

const parsedDocsCache = new Map<string, string[]>();
const PARSED_CACHE_LIMIT = 100;

function getCachedWordFrequency(doc: string): Map<string, number> {
  let freq = docFreqCache.get(doc);
  if (!freq) {
    freq = getWordFrequency(doc);
    if (docFreqCache.size >= CACHE_LIMIT) {
      const firstKey = docFreqCache.keys().next().value;
      if (firstKey !== undefined) docFreqCache.delete(firstKey);
    }
    docFreqCache.set(doc, freq);
  }
  return freq;
}

export const VectorDB = ({ node, incomingInput }: NodeExecutionContext): NodeExecutionResult => {
  const queryStr = typeof incomingInput === 'string'
    ? incomingInput
    : incomingInput !== null && incomingInput !== undefined
      ? JSON.stringify(incomingInput)
      : '';

  const model = node.data.embeddingModel || 'default';

  const rawDocs = node.data.documents || '';
  let docs = parsedDocsCache.get(rawDocs);
  if (!docs) {
    docs = rawDocs
      .split('\n')
      .map((d: string) => d.trim())
      .filter(Boolean);

    if (parsedDocsCache.size >= PARSED_CACHE_LIMIT) {
      const firstKey = parsedDocsCache.keys().next().value;
      if (firstKey !== undefined) parsedDocsCache.delete(firstKey);
    }
    parsedDocsCache.set(rawDocs, docs);
  }

  const threshold = node.data.similarityThreshold !== undefined
    ? node.data.similarityThreshold
    : 0;

  let log = `Running VectorDB query on ${docs.length} documents using model: ${model} with threshold ${threshold}`;

  const queryFreq = getWordFrequency(queryStr);
  const matchedItems: { doc: string; similarity: number }[] = [];
  const similarityCache = new Map<string, number>();

  for (const doc of docs) {
    let similarity = similarityCache.get(doc);
    if (similarity === undefined) {
      const docFreq = getCachedWordFrequency(doc);
      similarity = calculateCosineSimilarity(queryFreq, docFreq);
      similarityCache.set(doc, similarity);
    }
    if (similarity >= threshold) {
      matchedItems.push({ doc, similarity });
    }
  }

  const matches = matchedItems
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
