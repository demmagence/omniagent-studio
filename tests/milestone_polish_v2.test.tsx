import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';

describe('Milestone Polish v2: Undo/Redo, Workspace Controls, Node Filters', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
  });

  it('verifies undo and redo stack behavior when adding/removing nodes and edges', () => {
    render(<App />);

    // Initially canUndo and canRedo should be false
    expect(graphStore.getState().canUndo).toBe(false);
    expect(graphStore.getState().canRedo).toBe(false);

    // 1. Add node
    let nodeA: any;
    act(() => {
      nodeA = graphStore.addNode('LLM');
    });
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().canUndo).toBe(true);
    expect(graphStore.getState().canRedo).toBe(false);

    // 2. Undo adding node
    act(() => {
      graphStore.undo();
    });
    expect(graphStore.getState().nodes.length).toBe(0);
    expect(graphStore.getState().canUndo).toBe(false);
    expect(graphStore.getState().canRedo).toBe(true);

    // 3. Redo adding node
    act(() => {
      graphStore.redo();
    });
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().canUndo).toBe(true);
    expect(graphStore.getState().canRedo).toBe(false);

    // 4. Add another node and link them
    let nodeB: any;
    act(() => {
      nodeB = graphStore.addNode('Output');
      graphStore.addEdge(nodeA.id, nodeB.id);
    });
    expect(graphStore.getState().nodes.length).toBe(2);
    expect(graphStore.getState().edges.length).toBe(1);

    // 5. Undo edge connection
    act(() => {
      graphStore.undo();
    });
    expect(graphStore.getState().edges.length).toBe(0);
    expect(graphStore.getState().nodes.length).toBe(2);

    // 6. Undo node B adding
    act(() => {
      graphStore.undo();
    });
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes[0].id).toBe(nodeA.id);

    // 7. Redo node B adding
    act(() => {
      graphStore.redo();
    });
    expect(graphStore.getState().nodes.length).toBe(2);
    expect(graphStore.getState().edges.length).toBe(0);
  });

  it('triggers undo and redo via keyboard shortcuts Ctrl+Z / Ctrl+Y and ignores when typing', () => {
    render(<App />);

    act(() => {
      graphStore.addNode('LLM');
    });
    expect(graphStore.getState().nodes.length).toBe(1);

    // Dispatch Ctrl+Z to undo
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(graphStore.getState().nodes.length).toBe(0);

    // Dispatch Ctrl+Y to redo
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(graphStore.getState().nodes.length).toBe(1);

    // Dispatch Ctrl+Shift+Z to undo then redo
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(graphStore.getState().nodes.length).toBe(0);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(graphStore.getState().nodes.length).toBe(1);

    // Keyboard shortcut ignore when typing in input
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    // Should NOT have undone because input has focus
    expect(graphStore.getState().nodes.length).toBe(1);

    document.body.removeChild(input);
  });

  it('verifies Workspace Controls Panel zoom-in, zoom-out, and reset view buttons', () => {
    render(<App />);

    const panel = screen.getByTestId('workspace-controls-panel');
    expect(panel).toBeInTheDocument();

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    const zoomOutBtn = screen.getByTestId('zoom-out-btn');
    const resetViewBtn = screen.getByTestId('reset-view-btn');

    // Zoom In
    fireEvent.click(zoomInBtn);
    const zoomTextIn = screen.getByText(/Zoom/);
    expect(zoomTextIn.textContent).toContain('115%');

    // Zoom Out twice
    fireEvent.click(zoomOutBtn);
    fireEvent.click(zoomOutBtn);
    const zoomTextOut = screen.getByText(/Zoom/);
    expect(zoomTextOut.textContent).toContain('87%');

    // Reset View
    fireEvent.click(resetViewBtn);
    const zoomTextReset = screen.getByText(/Zoom/);
    expect(zoomTextReset.textContent).toContain('100%');
  });

  it('filters node palette buttons by search input and category filter buttons', () => {
    render(<App />);

    // Node Types originally: LLM, Prompt, Tool, Router, Output, VectorDB, JSONPath
    expect(screen.getByTestId('add-node-LLM')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Tool')).toBeInTheDocument();

    // 1. Filter by category "AI & Logic" (LLM, Prompt, Router)
    const aiTab = screen.getByTestId('category-tab-AI-&-Logic');
    fireEvent.click(aiTab);

    expect(screen.getByTestId('add-node-LLM')).toBeInTheDocument();
    expect(screen.queryByTestId('add-node-Tool')).toBeNull();

    // 2. Filter by category "Database & Tools" (Tool, VectorDB, JSONPath)
    const dbTab = screen.getByTestId('category-tab-Database-&-Tools');
    fireEvent.click(dbTab);

    expect(screen.queryByTestId('add-node-LLM')).toBeNull();
    expect(screen.getByTestId('add-node-Tool')).toBeInTheDocument();

    // 3. Search filter: "vector"
    const searchInput = screen.getByTestId('node-palette-search');
    fireEvent.change(searchInput, { target: { value: 'vector' } });

    expect(screen.queryByTestId('add-node-Tool')).toBeNull();
    expect(screen.getByTestId('add-node-VectorDB')).toBeInTheDocument();

    // Reset back to All and clear search
    const allTab = screen.getByTestId('category-tab-All');
    fireEvent.click(allTab);
    fireEvent.change(searchInput, { target: { value: '' } });

    expect(screen.getByTestId('add-node-LLM')).toBeInTheDocument();
    expect(screen.getByTestId('add-node-Tool')).toBeInTheDocument();
  });
});
