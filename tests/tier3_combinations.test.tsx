import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

describe('Tier 3: Cross-Feature Combinations', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('1. Add node -> Select node -> Edit config label -> verify state matches', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(addBtn);

    const nodes = graphStore.getState().nodes;
    const nodeEl = screen.getByTestId(`node-item-${nodes[0].id}`);
    fireEvent.click(nodeEl);

    const labelInput = screen.getByTestId('config-label-input') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Customer LLM' } });

    expect(graphStore.getState().nodes[0].data.label).toBe('Customer LLM');
    expect(screen.getByTestId(`node-item-${nodes[0].id}`)).toHaveTextContent('Customer LLM');
  });

  it('2. Add Prompt & LLM -> Connect them -> Edit Prompt template -> Run execution -> verify output has Prompt template output', async () => {
    let pId = '';
    let lId = '';
    act(() => {
      pId = graphStore.addNode('Prompt').id;
      lId = graphStore.addNode('LLM').id;
      graphStore.addEdge(pId, lId);
      graphStore.updateNodeData(pId, { promptTemplate: 'Summarize: {input}' });
      graphStore.updateNodeData(lId, { provider: 'openai', model: 'gpt-4o' });
    });

    const steps = await executeWorkflow({ fallback: true });
    const pStep = steps.find(s => s.nodeId === pId);
    const lStep = steps.find(s => s.nodeId === lId);

    expect(pStep?.output).toBe('Summarize: {input}');
    expect(lStep?.input).toBe('Summarize: {input}');
    expect(lStep?.output).toContain('[Simulated openai - Model: gpt-4o]');
  });

  it('3. Add nodes -> connect -> Export graph -> Reset graph -> Import graph -> verify graph is identical', () => {
    render(<App />);
    let n1Id = '';
    let n2Id = '';
    act(() => {
      n1Id = graphStore.addNode('Prompt').id;
      n2Id = graphStore.addNode('LLM').id;
      graphStore.addEdge(n1Id, n2Id);
    });

    // Click Export
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    const exportedJson = (screen.getByTestId('serialized-output') as HTMLTextAreaElement).value;

    // Reset workspace
    const resetBtn = screen.getByTestId('reset-btn');
    fireEvent.click(resetBtn);
    expect(graphStore.getState().nodes.length).toBe(0);

    // Paste and Import
    const importInput = screen.getByTestId('import-input') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    fireEvent.change(importInput, { target: { value: exportedJson } });
    fireEvent.click(importBtn);

    const state = graphStore.getState();
    expect(state.nodes.length).toBe(2);
    expect(state.edges.length).toBe(1);
    expect(state.nodes.some(n => n.type === 'Prompt')).toBe(true);
    expect(state.nodes.some(n => n.type === 'LLM')).toBe(true);
  });

  it('4. Import graph -> edit imported node config -> Run execution -> check updated behavior', async () => {
    const jsonStr = JSON.stringify({
      nodes: [
        {
          id: 'imported_prompt',
          type: 'Prompt',
          position: { x: 10, y: 10 },
          data: { label: 'Old Prompt Label', type: 'Prompt', promptTemplate: 'Hello {input}' }
        }
      ],
      edges: []
    });

    act(() => {
      const { nodes, edges } = JSON.parse(jsonStr);
      graphStore.setGraph(nodes, edges);
    });

    // Edit configuration
    act(() => {
      graphStore.updateNodeData('imported_prompt', { promptTemplate: 'Modified Prompt {input}' });
    });

    const steps = await executeWorkflow({ fallback: true });
    expect(steps.find(s => s.nodeId === 'imported_prompt')?.output).toBe('Modified Prompt {input}');
  });

  it('5. Add nodes -> connect -> Run execution -> Export graph -> verify trace steps are NOT exported', () => {
    render(<App />);
    act(() => {
      const n1 = graphStore.addNode('Prompt');
      const n2 = graphStore.addNode('Output');
      graphStore.addEdge(n1.id, n2.id);
    });

    // Run execution to populate trace steps in store
    act(() => {
      graphStore.setTraceSteps([
        { nodeId: 'n1', status: 'completed', input: 'a', output: 'b', log: 'done', tokensConsumed: 10 }
      ]);
    });

    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    const exportedJson = (screen.getByTestId('serialized-output') as HTMLTextAreaElement).value;
    const parsed = JSON.parse(exportedJson);

    // Exported JSON must contain nodes and edges, but NOT traceSteps
    expect(parsed.nodes).toBeDefined();
    expect(parsed.edges).toBeDefined();
    expect(parsed.traceSteps).toBeUndefined();
  });

  it('6. Run execution in fallback mode vs real mode with network intercept', async () => {
    act(() => {
      const n = graphStore.addNode('LLM');
      graphStore.updateNodeData(n.id, { provider: 'openai', model: 'gpt-4o' });
    });

    // Fallback mode execution runs successfully
    const steps = await executeWorkflow({ fallback: true });
    expect(steps[0].status).toBe('completed');

    // Real mode execution fails due to network call interception
    await expect(executeWorkflow({ fallback: false })).rejects.toThrow(/External network call blocked/);
  });

  it('7. Delete connected node -> verify connected edges are removed in state', () => {
    render(<App />);
    let n1Id = '';
    let n2Id = '';
    act(() => {
      n1Id = graphStore.addNode('Prompt').id;
      n2Id = graphStore.addNode('LLM').id;
      graphStore.addEdge(n1Id, n2Id);
    });

    expect(graphStore.getState().edges.length).toBe(1);

    // Delete node n1
    const deleteBtn = screen.getByTestId(`delete-node-${n1Id}`);
    fireEvent.click(deleteBtn);

    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().edges.length).toBe(0);
  });

  it('8. Import invalid graph -> triggers alerts/fails -> original graph remains unchanged', () => {
    render(<App />);
    let nId = '';
    act(() => {
      nId = graphStore.addNode('LLM').id;
    });

    // Mock window.alert to prevent jsdom crash
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const importInput = screen.getByTestId('import-input') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    // Paste invalid json
    fireEvent.change(importInput, { target: { value: '{"nodes": "not_an_array"}' } });
    fireEvent.click(importBtn);

    expect(alertSpy).toHaveBeenCalled();
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].id).toBe(nId);
  });

  it('9. Add Node -> click Node (selects) -> click canvas background -> node is deselected', () => {
    render(<App />);
    const addBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(addBtn);

    const node = graphStore.getState().nodes[0];
    const nodeEl = screen.getByTestId(`node-item-${node.id}`);

    // Click to select
    fireEvent.click(nodeEl);
    expect(graphStore.getState().selectedNodeId).toBe(node.id);

    // Click canvas background
    const canvasEl = screen.getByTestId('canvas');
    fireEvent.click(canvasEl);
    expect(graphStore.getState().selectedNodeId).toBeNull();
  });

  it('10. Execute workflow -> verify Tracing Console lists steps and updates total token count', async () => {
    render(<App />);
    let nId = '';
    act(() => {
      nId = graphStore.addNode('LLM').id;
      graphStore.updateNodeData(nId, { label: 'Main LLM', provider: 'openai', model: 'gpt-4o' });
    });

    const runBtn = screen.getByTestId('run-workflow-btn');
    fireEvent.click(runBtn);

    // Wait for async execution
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId(`trace-step-${nId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`trace-status-${nId}`)).toHaveTextContent('COMPLETED');
    expect(screen.getByTestId('total-tokens')).not.toHaveTextContent('0');
  });

  it('11. Add Node -> Connect to self (should fail) -> verify edges list is empty', () => {
    render(<App />);
    let nId = '';
    act(() => {
      nId = graphStore.addNode('LLM').id;
    });

    // Try to connect to self using connect select
    const selectEl = screen.getByTestId(`connect-select-${nId}`);
    fireEvent.change(selectEl, { target: { value: nId } });

    const connectBtn = screen.getByTestId(`connect-btn-${nId}`);
    fireEvent.click(connectBtn);

    expect(graphStore.getState().edges.length).toBe(0);
  });

  it('12. Export blank graph -> yields empty json -> imports empty json successfully', () => {
    render(<App />);
    // Export empty graph
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    const exportedJson = (screen.getByTestId('serialized-output') as HTMLTextAreaElement).value;
    const parsed = JSON.parse(exportedJson);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);

    // Import it back
    const importInput = screen.getByTestId('import-input') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    fireEvent.change(importInput, { target: { value: exportedJson } });
    fireEvent.click(importBtn);

    expect(graphStore.getState().nodes.length).toBe(0);
    expect(graphStore.getState().edges.length).toBe(0);
  });
});
