import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar';
import { graphStore } from '../src/store/graphStore';
import * as graphUtils from '../src/utils/graphUtils';

// Mock the graphUtils as they are explicitly used by the Sidebar Component
vi.mock('../src/utils/graphUtils', async () => {
  const actual = await vi.importActual('../src/utils/graphUtils');
  return {
    ...actual,
    autoLayout: vi.fn(),
    serializeGraph: vi.fn(() => '{"mock": "graph"}'),
    deserializeGraph: vi.fn(() => ({ nodes: [], edges: [] }))
  };
});

describe('Sidebar Component', () => {
  beforeEach(() => {
    // Reset graphStore state before each test
    graphStore.resetGraph();
    vi.clearAllMocks();
  });

  it('calls graphStore.addNode when a node type button is clicked', () => {
    const addNodeSpy = vi.spyOn(graphStore, 'addNode');

    render(<Sidebar />);

    const llmBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(llmBtn);

    expect(addNodeSpy).toHaveBeenCalledWith('LLM', expect.any(Object));
  });

  it('calls graphStore.setFallbackMode when fallback mode is toggled', () => {
    const setFallbackModeSpy = vi.spyOn(graphStore, 'setFallbackMode');

    render(<Sidebar />);

    const fallbackToggle = screen.getByTestId('fallback-mode-toggle');
    fireEvent.click(fallbackToggle);

    // Initially fallback mode is true in store, so click sets it to false if checkbox is connected to it
    expect(setFallbackModeSpy).toHaveBeenCalled();
  });

  it('calls graphStore.setMaxConcurrency when concurrency input changes', () => {
    const setMaxConcurrencySpy = vi.spyOn(graphStore, 'setMaxConcurrency');

    render(<Sidebar />);

    const maxConcurrencyInput = screen.getByTestId('max-concurrency-input');
    fireEvent.change(maxConcurrencyInput, { target: { value: '5' } });

    expect(setMaxConcurrencySpy).toHaveBeenCalledWith(5);
  });

  it('calls graphStore.resetGraph when reset workspace button is clicked', () => {
    const resetGraphSpy = vi.spyOn(graphStore, 'resetGraph');

    render(<Sidebar />);

    const resetBtn = screen.getByTestId('reset-btn');
    fireEvent.click(resetBtn);

    expect(resetGraphSpy).toHaveBeenCalled();
  });

  it('calls handleAutoLayout and updates node positions when auto layout button is clicked', () => {
    // Setup a node to layout
    const node = graphStore.addNode('LLM');

    const updateNodePositionSpy = vi.spyOn(graphStore, 'updateNodePosition');

    // Mock autoLayout to return new positions
    const mockPositions = new Map();
    mockPositions.set(node.id, { x: 500, y: 500 });
    vi.mocked(graphUtils.autoLayout).mockReturnValue(mockPositions);

    render(<Sidebar />);

    const layoutBtn = screen.getByTestId('auto-layout-btn');
    fireEvent.click(layoutBtn);

    expect(graphUtils.autoLayout).toHaveBeenCalled();
    expect(updateNodePositionSpy).toHaveBeenCalledWith(node.id, { x: 500, y: 500 });
  });

  it('handles history clear correctly', () => {
    // Add history so the button appears
    graphStore.addRunToHistory({
      nodes: [],
      edges: [],
      traceSteps: [],
      status: 'success'
    });

    const clearHistorySpy = vi.spyOn(graphStore, 'clearHistory');

    render(<Sidebar />);

    const clearHistoryBtn = screen.getByTestId('clear-history-btn');
    fireEvent.click(clearHistoryBtn);

    expect(clearHistorySpy).toHaveBeenCalled();
  });

  it('handles export properly', () => {
    render(<Sidebar />);

    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    expect(graphUtils.serializeGraph).toHaveBeenCalled();
    const output = screen.getByTestId('serialized-output');
    expect(output).toBeInTheDocument();
  });

  it('handles import properly', () => {
    const setGraphSpy = vi.spyOn(graphStore, 'setGraph');
    render(<Sidebar />);

    const importInput = screen.getByTestId('import-input');
    fireEvent.change(importInput, { target: { value: '{"mock": "import"}' } });

    const importBtn = screen.getByTestId('import-btn');
    fireEvent.click(importBtn);

    expect(graphUtils.deserializeGraph).toHaveBeenCalledWith('{"mock": "import"}');
    expect(setGraphSpy).toHaveBeenCalled();
  });
});
