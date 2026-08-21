import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Canvas } from '../src/components/Canvas';
import { graphStore } from '../src/store/graphStore';

describe('Canvas Component', () => {
  beforeEach(() => {
    graphStore.resetGraph();
  });

  it('renders the canvas component', () => {
    render(<Canvas />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('renders nodes and edges', () => {
    graphStore.setGraph([
      { id: 'n1', type: 'LLM', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'LLM' } }
    ], []);
    render(<Canvas />);
    expect(screen.getByTestId('node-item-n1')).toBeInTheDocument();
  });

  it('handles selection', () => {
    // Select a node first to verify it clears
    graphStore.setGraph([
      { id: 'n1', type: 'LLM', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'LLM' } }
    ], []);
    graphStore.selectNode('n1');
    expect(graphStore.getState().selectedNodeId).toBe('n1');

    render(<Canvas />);
    fireEvent.mouseDown(screen.getByTestId('canvas'));
    fireEvent.mouseUp(screen.getByTestId('canvas')); // Need both for standard click often, but our code uses CanvasClick and mousedown

    fireEvent.click(screen.getByTestId('canvas'));

    expect(graphStore.getState().selectedNodeId).toBeNull();
  });

  it('handles zoom operations', () => {
    graphStore.setGraph([
      { id: 'n1', type: 'LLM', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'LLM' } }
    ], []);
    render(<Canvas />);

    expect(screen.getByText(/Zoom \(100%\)/)).toBeInTheDocument();

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    fireEvent.click(zoomInBtn);

    expect(screen.getByText(/Zoom \(115%\)/)).toBeInTheDocument();
  });

  it('simulates node drag', () => {
    graphStore.setGraph([
      { id: 'n1', type: 'LLM', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'LLM' } }
    ], []);
    render(<Canvas />);

    const nodeItem = screen.getByTestId('node-item-n1');

    // Simulate drag start
    fireEvent.mouseDown(nodeItem, { clientX: 100, clientY: 100 });

    // Simulate drag move
    fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });

    // Check if the store updated the position
    // Since zoom is 1 by default, dx = 50, dy = 50
    const state = graphStore.getState();
    expect(state.nodes[0].position.x).toBe(50);
    expect(state.nodes[0].position.y).toBe(50);

    // Clean up drag
    fireEvent.mouseUp(window);
  });

  it('simulates connecting nodes', () => {
    graphStore.setGraph([
      { id: 'n1', type: 'LLM', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'LLM' } },
      { id: 'n2', type: 'Prompt', position: { x: 200, y: 0 }, data: { label: 'Node 2', type: 'Prompt' } }
    ], []);

    render(<Canvas />);

    const outPort = screen.getByTestId('port-out-n1');

    // Start drag
    fireEvent.mouseDown(outPort, { clientX: 0, clientY: 0 });

    // Move
    fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });

    // Ensure connection line renders during drag
    // Find the input port and set it as elementFromPoint target
    // We mock document.elementFromPoint
    const inPort = screen.getByTestId('port-in-n2');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (x, y) => {
      if (x === 200 && y === 0) return inPort;
      return null;
    };

    // Release on target
    fireEvent.mouseUp(window, { clientX: 200, clientY: 0 });

    // Restore
    document.elementFromPoint = originalElementFromPoint;

    // Verify
    const state = graphStore.getState();
    expect(state.edges.length).toBe(1);
    expect(state.edges[0].source).toBe('n1');
    expect(state.edges[0].target).toBe('n2');
  });
});
