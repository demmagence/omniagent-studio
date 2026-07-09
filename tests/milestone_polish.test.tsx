import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';
import { Node } from '../src/types';

describe('Milestone Polish: Auto Layout, Keyboard Shortcuts, and Stats Console', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
  });

  it('triggers auto layout and updates node positions', () => {
    render(<App />);
    let nodeA: Node | undefined;
    let nodeB: Node | undefined;
    act(() => {
      nodeA = graphStore.addNode('LLM', { x: 50, y: 50 });
      nodeB = graphStore.addNode('Output', { x: 50, y: 50 });
      if (!nodeA || !nodeB) {
        throw new Error('Expected nodes to be created before linking');
      }
      graphStore.addEdge(nodeA.id, nodeB.id);
    });

    const layoutBtn = screen.getByTestId('auto-layout-btn');
    expect(layoutBtn).toBeEnabled();

    // Trigger auto layout
    fireEvent.click(layoutBtn);

    const state = graphStore.getState();
    const updatedA = state.nodes.find((n) => n.id === nodeA!.id);
    const updatedB = state.nodes.find((n) => n.id === nodeB!.id);

    // Nodes should have been repositioned to different X coordinates because of layers
    expect(updatedA?.position.x).not.toBe(50);
    expect(updatedB?.position.x).not.toBe(50);
    expect(updatedA?.position.x).not.toBe(updatedB?.position.x);

    // Enter replay mode by adding a history run and selecting it
    act(() => {
      graphStore.addRunToHistory({
        nodes: state.nodes,
        edges: state.edges,
        traceSteps: [],
        status: 'success',
      });
      const runId = graphStore.getState().history[0].id;
      graphStore.selectRun(runId);
    });

    // The layout button should be disabled in replay mode
    expect(layoutBtn).toBeDisabled();
  });

  it('handles Escape to deselect, and Delete/Backspace to delete selected node', () => {
    render(<App />);
    let node: Node | undefined;
    act(() => {
      node = graphStore.addNode('LLM');
      if (!node) throw new Error('Node should be created');
      graphStore.selectNode(node.id);
    });

    expect(graphStore.getState().selectedNodeId).toBe(node!.id);

    // Escape deselects
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(graphStore.getState().selectedNodeId).toBeNull();

    // Select again
    act(() => {
      graphStore.selectNode(node!.id);
    });
    expect(graphStore.getState().selectedNodeId).toBe(node!.id);

    // Delete removes node
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(graphStore.getState().nodes.find((n) => n.id === node!.id)).toBeUndefined();

    // Add another node and select it
    let node2: Node | undefined;
    act(() => {
      node2 = graphStore.addNode('Prompt');
      if (!node2) throw new Error('Node 2 should be created');
      graphStore.selectNode(node2.id);
    });
    expect(graphStore.getState().nodes.find((n) => n.id === node2!.id)).toBeDefined();

    // Backspace removes node too
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(graphStore.getState().nodes.find((n) => n.id === node2!.id)).toBeUndefined();
  });

  it('does not remove selected node if user is typing in input or textarea', () => {
    render(<App />);
    let node: Node | undefined;
    act(() => {
      node = graphStore.addNode('LLM');
      if (!node) throw new Error('Node should be created');
      graphStore.selectNode(node.id);
    });

    // Create a temporary input element, focus it, and dispatch keydown on it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'Delete' });
    // Node should still exist
    expect(graphStore.getState().nodes.find((n) => n.id === node!.id)).toBeDefined();

    // Cleanup
    document.body.removeChild(input);
  });

  it('renders execution statistics counts in TracingConsole', () => {
    render(<App />);
    
    // Initially stats should not render because traceSteps is empty
    expect(screen.queryByTestId('execution-stats')).toBeNull();

    // Set trace steps in store
    act(() => {
      graphStore.setTraceSteps([
        { nodeId: 'node_1', status: 'completed', input: null, output: null, tokensConsumed: 120 },
        { nodeId: 'node_2', status: 'failed', input: null, output: null, tokensConsumed: 50 },
        { nodeId: 'node_3', status: 'pending', input: null, output: null, tokensConsumed: 0 },
        { nodeId: 'node_4', status: 'running', input: null, output: null, tokensConsumed: 30 },
      ]);
    });

    const statsPanel = screen.getByTestId('execution-stats');
    expect(statsPanel).toBeInTheDocument();

    expect(screen.getByTestId('stats-completed').textContent).toBe('1');
    expect(screen.getByTestId('stats-failed').textContent).toBe('1');
    expect(screen.getByTestId('stats-pending').textContent).toBe('1'); // node_3 (pending) and node_4 is running
    expect(screen.getByTestId('stats-running').textContent).toBe('1');
    expect(screen.getByTestId('total-tokens').textContent).toBe('200'); // 120 + 50 + 30
  });
});
