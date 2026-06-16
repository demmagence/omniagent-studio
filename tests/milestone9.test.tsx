import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';
import * as apiModule from '../src/services/api';

describe('Milestone 9: Advanced Node Types', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('adds and configures Vector DB and JSON Path Selector nodes in UI', () => {
    render(<App />);

    // Add VectorDB Node
    const addVectorDBBtn = screen.getByTestId('add-node-VectorDB');
    fireEvent.click(addVectorDBBtn);
    const nodesAfterVectorDB = graphStore.getState().nodes;
    expect(nodesAfterVectorDB.some(n => n.type === 'VectorDB')).toBe(true);
    const vectorDBNode = nodesAfterVectorDB.find(n => n.type === 'VectorDB')!;

    // Add JSONPath Node
    const addJSONPathBtn = screen.getByTestId('add-node-JSONPath');
    fireEvent.click(addJSONPathBtn);
    const nodesAfterJSONPath = graphStore.getState().nodes;
    expect(nodesAfterJSONPath.some(n => n.type === 'JSONPath')).toBe(true);
    const jsonPathNode = nodesAfterJSONPath.find(n => n.type === 'JSONPath')!;

    // Select and configure VectorDB
    act(() => {
      graphStore.selectNode(vectorDBNode.id);
    });

    const embeddingModelInput = screen.getByTestId('config-embedding-model-input') as HTMLInputElement;
    const documentsInput = screen.getByTestId('config-documents-input') as HTMLTextAreaElement;
    const similarityThresholdInput = screen.getByTestId('config-similarity-threshold-input') as HTMLInputElement;

    fireEvent.change(embeddingModelInput, { target: { value: 'text-embedding-3-large' } });
    fireEvent.change(documentsInput, { target: { value: 'Document One\nDocument Two\nSomething Else' } });
    fireEvent.change(similarityThresholdInput, { target: { value: '0.45' } });

    const updatedVectorDBNode = graphStore.getState().nodes.find(n => n.id === vectorDBNode.id)!;
    expect(updatedVectorDBNode.data.embeddingModel).toBe('text-embedding-3-large');
    expect(updatedVectorDBNode.data.documents).toBe('Document One\nDocument Two\nSomething Else');
    expect(updatedVectorDBNode.data.similarityThreshold).toBe(0.45);

    // Select and configure JSONPath
    act(() => {
      graphStore.selectNode(jsonPathNode.id);
    });

    const jsonPathInput = screen.getByTestId('config-jsonpath-input') as HTMLInputElement;
    fireEvent.change(jsonPathInput, { target: { value: 'data.users[0].name' } });

    const updatedJSONPathNode = graphStore.getState().nodes.find(n => n.id === jsonPathNode.id)!;
    expect(updatedJSONPathNode.data.jsonPath).toBe('data.users[0].name');
  });

  it('runs a workflow where a JSON Path Selector node extracts nested values from an LLM node output', async () => {
    const mockJson = {
      user: {
        profile: {
          name: 'Alice',
          roles: ['admin', 'user']
        }
      }
    };
    vi.spyOn(apiModule, 'callLLM').mockResolvedValue({
      text: JSON.stringify(mockJson),
      tokensUsed: 42
    });

    let llmNodeId = '';
    let jsonPathNodeId = '';
    act(() => {
      // Create LLM Node
      const llmNode = graphStore.addNode('LLM');
      llmNodeId = llmNode.id;
      graphStore.updateNodeData(llmNodeId, { provider: 'openai', model: 'gpt-4o' });

      // Create JSONPath Node
      const jsonPathNode = graphStore.addNode('JSONPath');
      jsonPathNodeId = jsonPathNode.id;
      graphStore.updateNodeData(jsonPathNodeId, { jsonPath: 'user.profile.roles[0]' });

      // Connect LLM -> JSONPath
      graphStore.addEdge(llmNodeId, jsonPathNodeId);
    });

    const steps = await executeWorkflow({ fallback: false });

    const llmStep = steps.find(s => s.nodeId === llmNodeId);
    const jsonPathStep = steps.find(s => s.nodeId === jsonPathNodeId);

    expect(llmStep?.status).toBe('completed');
    expect(llmStep?.output).toBe(JSON.stringify(mockJson));

    expect(jsonPathStep?.status).toBe('completed');
    expect(jsonPathStep?.input).toBe(JSON.stringify(mockJson));
    expect(jsonPathStep?.output).toBe('admin');
  });

  it('runs a workflow where a Vector DB node filters mock documents based on query similarity', async () => {
    let promptNodeId = '';
    let vectorDBNodeId = '';

    act(() => {
      // Prompt Node to generate the query
      const promptNode = graphStore.addNode('Prompt');
      promptNodeId = promptNode.id;
      graphStore.updateNodeData(promptNodeId, { promptTemplate: 'apples and oranges' });

      // VectorDB Node
      const vectorDBNode = graphStore.addNode('VectorDB');
      vectorDBNodeId = vectorDBNode.id;
      graphStore.updateNodeData(vectorDBNodeId, {
        embeddingModel: 'text-embedding-3-small',
        documents: 'apples and oranges\noranges and pears\nbanana split',
        similarityThreshold: 0.5
      });

      // Connect Prompt -> VectorDB
      graphStore.addEdge(promptNodeId, vectorDBNodeId);
    });

    const steps = await executeWorkflow({ fallback: true });

    const promptStep = steps.find(s => s.nodeId === promptNodeId);
    const vectorDBStep = steps.find(s => s.nodeId === vectorDBNodeId);

    expect(promptStep?.status).toBe('completed');
    expect(promptStep?.output).toBe('apples and oranges');

    expect(vectorDBStep?.status).toBe('completed');
    expect(vectorDBStep?.input).toBe('apples and oranges');
    expect(vectorDBStep?.output).toEqual([
      'apples and oranges',
      'oranges and pears'
    ]);
  });
});
