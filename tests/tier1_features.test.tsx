import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';

describe('Tier 1: Feature Coverage', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
  });

  it('renders node palette buttons', () => {
    render(<App />);
    expect(screen.getByTestId('add-node-LLM')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Prompt')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Tool')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Router')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Output')).toBeInTheDocument();
  });

  it('adds an LLM node', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(addBtn);
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].type).toBe('LLM');
  });

  it('adds a Prompt node', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-Prompt');
    fireEvent.click(addBtn);
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].type).toBe('Prompt');
  });

  it('adds a Tool node', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-Tool');
    fireEvent.click(addBtn);
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].type).toBe('Tool');
  });

  it('adds a Router node', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-Router');
    fireEvent.click(addBtn);
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].type).toBe('Router');
  });

  it('adds an Output node', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-Output');
    fireEvent.click(addBtn);
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].type).toBe('Output');
  });

  it('toggles fallback execution mode', () => {
    render(<App />);
    const toggle = screen.getByTestId('fallback-mode-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(graphStore.getState().isFallbackMode).toBe(false);
  });

  it('renders added nodes in workspace canvas', () => {
    render(<App />);
    act(() => {
      graphStore.addNode('LLM');
    });
    const nodes = graphStore.getState().nodes;
    expect(screen.getByTestId(`node-item-${nodes[0].id}`)).toBeInTheDocument();
  });

  it('selects node on click in canvas', () => {
    render(<App />);
    act(() => {
      graphStore.addNode('Prompt');
    });
    const node = graphStore.getState().nodes[0];
    const nodeEl = screen.getByTestId(`node-item-${node.id}`);
    fireEvent.click(nodeEl);
    expect(graphStore.getState().selectedNodeId).toBe(node.id);
  });

  it('deletes a node using deletion button', () => {
    render(<App />);
    act(() => {
      graphStore.addNode('LLM');
    });
    const node = graphStore.getState().nodes[0];
    const deleteBtn = screen.getByTestId(`delete-node-${node.id}`);
    fireEvent.click(deleteBtn);
    expect(graphStore.getState().nodes.length).toBe(0);
  });

  it('connects two nodes using connection menu in canvas', () => {
    render(<App />);
    let nodeAId = '';
    let nodeBId = '';
    act(() => {
      nodeAId = graphStore.addNode('Prompt').id;
      nodeBId = graphStore.addNode('LLM').id;
    });

    const selectEl = screen.getByTestId(`connect-select-${nodeAId}`);
    fireEvent.change(selectEl, { target: { value: nodeBId } });

    const connectBtn = screen.getByTestId(`connect-btn-${nodeAId}`);
    fireEvent.click(connectBtn);

    expect(graphStore.getState().edges.length).toBe(1);
    expect(graphStore.getState().edges[0].source).toBe(nodeAId);
    expect(graphStore.getState().edges[0].target).toBe(nodeBId);
  });

  it('deletes an edge using edge remove button', () => {
    render(<App />);
    let edgeId = '';
    act(() => {
      const n1 = graphStore.addNode('Prompt');
      const n2 = graphStore.addNode('LLM');
      const edge = graphStore.addEdge(n1.id, n2.id);
      edgeId = edge?.id || '';
    });

    const removeEdgeBtn = screen.getByTestId(`delete-edge-${edgeId}`);
    fireEvent.click(removeEdgeBtn);
    expect(graphStore.getState().edges.length).toBe(0);
  });

  it('displays default prompt in ConfigPanel when no node selected', () => {
    render(<App />);
    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveTextContent(/Select a node/i);
  });

  it('displays config fields when a node is selected', () => {
    render(<App />);
    let nodeId = '';
    act(() => {
      nodeId = graphStore.addNode('LLM').id;
      graphStore.selectNode(nodeId);
    });
    expect(screen.getByTestId('config-label-input')).toBeInTheDocument();
  });

  it('updates node label in state when edited', () => {
    render(<App />);
    let nodeId = '';
    act(() => {
      nodeId = graphStore.addNode('LLM').id;
      graphStore.selectNode(nodeId);
    });
    const labelInput = screen.getByTestId('config-label-input') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'My Special LLM' } });
    expect(graphStore.getState().nodes[0].data.label).toBe('My Special LLM');
  });

  it('renders LLM provider select and model inputs for LLM node', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('LLM');
      graphStore.selectNode(node.id);
    });
    expect(screen.getByTestId('config-provider-select')).toBeInTheDocument();
    expect(screen.getByTestId('config-model-input')).toBeInTheDocument();
  });

  it('updates LLM provider and model in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('LLM');
      graphStore.selectNode(node.id);
    });
    const providerSelect = screen.getByTestId('config-provider-select') as HTMLSelectElement;
    const modelInput = screen.getByTestId('config-model-input') as HTMLInputElement;

    fireEvent.change(providerSelect, { target: { value: 'ollama' } });
    fireEvent.change(modelInput, { target: { value: 'llama3:8b' } });

    expect(graphStore.getState().nodes[0].data.provider).toBe('ollama');
    expect(graphStore.getState().nodes[0].data.model).toBe('llama3:8b');
  });

  it('updates API key and Endpoint URL in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('LLM');
      graphStore.selectNode(node.id);
    });
    const keyInput = screen.getByTestId('config-apikey-input') as HTMLInputElement;
    const urlInput = screen.getByTestId('config-endpoint-input') as HTMLInputElement;

    fireEvent.change(keyInput, { target: { value: 'sk-123456' } });
    fireEvent.change(urlInput, { target: { value: 'https://mycustomapi.com' } });

    expect(graphStore.getState().nodes[0].data.apiKey).toBe('sk-123456');
    expect(graphStore.getState().nodes[0].data.endpointUrl).toBe('https://mycustomapi.com');
  });

  it('updates System Prompt in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('LLM');
      graphStore.selectNode(node.id);
    });
    const systemPromptInput = screen.getByTestId('config-system-prompt-input') as HTMLTextAreaElement;
    fireEvent.change(systemPromptInput, { target: { value: 'You are a pirate.' } });
    expect(graphStore.getState().nodes[0].data.systemPrompt).toBe('You are a pirate.');
  });

  it('renders prompt template input for Prompt node', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Prompt');
      graphStore.selectNode(node.id);
    });
    expect(screen.getByTestId('config-prompt-template-input')).toBeInTheDocument();
  });

  it('updates prompt template input in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Prompt');
      graphStore.selectNode(node.id);
    });
    const templateInput = screen.getByTestId('config-prompt-template-input') as HTMLTextAreaElement;
    fireEvent.change(templateInput, { target: { value: 'Translate to French: {input}' } });
    expect(graphStore.getState().nodes[0].data.promptTemplate).toBe('Translate to French: {input}');
  });

  it('renders tool name select for Tool node', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Tool');
      graphStore.selectNode(node.id);
    });
    expect(screen.getByTestId('config-tool-name-select')).toBeInTheDocument();
  });

  it('updates tool name select in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Tool');
      graphStore.selectNode(node.id);
    });
    const toolSelect = screen.getByTestId('config-tool-name-select') as HTMLSelectElement;
    fireEvent.change(toolSelect, { target: { value: 'webSearch' } });
    expect(graphStore.getState().nodes[0].data.toolName).toBe('webSearch');
  });

  it('renders routing rules input for Router node', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Router');
      graphStore.selectNode(node.id);
    });
    expect(screen.getByTestId('config-routing-rules-input')).toBeInTheDocument();
  });

  it('updates routing rules in state on change', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Router');
      graphStore.selectNode(node.id);
    });
    const rulesInput = screen.getByTestId('config-routing-rules-input') as HTMLTextAreaElement;
    fireEvent.change(rulesInput, { target: { value: 'contains yes -> tool' } });
    expect(graphStore.getState().nodes[0].data.routingRules).toBe('contains yes -> tool');
  });

  it('renders simple text explanation for Output node', () => {
    render(<App />);
    act(() => {
      const node = graphStore.addNode('Output');
      graphStore.selectNode(node.id);
    });
    expect(screen.getByTestId('config-panel')).toHaveTextContent(/This node gathers the execution results/i);
  });

  it('displays empty trace message initially', () => {
    render(<App />);
    expect(screen.getByTestId('tracing-console')).toHaveTextContent(/No trace steps/i);
  });

  it('run workflow button is disabled when nodes are empty', () => {
    render(<App />);
    const runBtn = screen.getByTestId('run-workflow-btn');
    expect(runBtn).toBeDisabled();
  });

  it('exports graph to JSON in textarea when export clicked', () => {
    render(<App />);
    act(() => {
      graphStore.addNode('LLM');
    });
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);
    const outputTextarea = screen.getByTestId('serialized-output') as HTMLTextAreaElement;
    expect(outputTextarea.value).toContain('LLM');
    expect(outputTextarea.value).toContain('New LLM Node');
  });

  it('imports graph state from pasted JSON textarea', () => {
    render(<App />);
    const jsonStr = JSON.stringify({
      nodes: [
        {
          id: 'node_imported',
          type: 'Prompt',
          position: { x: 50, y: 50 },
          data: { label: 'Imported Prompt', type: 'Prompt' }
        }
      ],
      edges: []
    });

    const importInput = screen.getByTestId('import-input') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    fireEvent.change(importInput, { target: { value: jsonStr } });
    fireEvent.click(importBtn);

    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].id).toBe('node_imported');
    expect(graphStore.getState().nodes[0].data.label).toBe('Imported Prompt');
  });

  it('resets the graph and workspace when reset clicked', () => {
    render(<App />);
    act(() => {
      graphStore.addNode('LLM');
    });
    expect(graphStore.getState().nodes.length).toBe(1);

    const resetBtn = screen.getByTestId('reset-btn');
    fireEvent.click(resetBtn);

    expect(graphStore.getState().nodes.length).toBe(0);
    expect(graphStore.getState().edges.length).toBe(0);
  });
});
