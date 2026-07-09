import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';
import { Node } from '../src/types';

describe('Milestone 8: Visual Canvas Features', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
  });

  it('updates node position coordinates in graphStore', () => {
    let node: Node | undefined;
    act(() => {
      node = graphStore.addNode('LLM');
    });
    expect(node).toBeDefined();
    
    act(() => {
      graphStore.updateNodePosition(node!.id, { x: 250, y: 350 });
    });
    
    const updatedNode = graphStore.getState().nodes.find(n => n.id === node!.id);
    expect(updatedNode?.position).toEqual({ x: 250, y: 350 });
  });

  it('renders input and output ports on nodes', () => {
    render(<App />);
    let node: Node | undefined;
    act(() => {
      node = graphStore.addNode('LLM');
    });

    const portIn = screen.getByTestId(`port-in-${node!.id}`);
    const portOut = screen.getByTestId(`port-out-${node!.id}`);
    
    expect(portIn).toBeInTheDocument();
    expect(portOut).toBeInTheDocument();
  });

  it('simulates port dragging to create connections', () => {
    render(<App />);
    let nodeA: Node | undefined;
    let nodeB: Node | undefined;
    act(() => {
      nodeA = graphStore.addNode('LLM');
      nodeB = graphStore.addNode('Output');
    });

    if (!nodeA || !nodeB) throw new Error('Nodes should be created');

    const portBIn = screen.getByTestId(`port-in-${nodeB.id}`);
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(portBIn);

    const portAOut = screen.getByTestId(`port-out-${nodeA.id}`);
    
    fireEvent.mouseDown(portAOut, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(window, { clientX: 200, clientY: 200 });

    const edges = graphStore.getState().edges;
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe(nodeA.id);
    expect(edges[0].target).toBe(nodeB.id);

    document.elementFromPoint = originalElementFromPoint;
  });

  it('simulates node dragging and updates position in state', () => {
    render(<App />);
    let node: Node | undefined;
    act(() => {
      node = graphStore.addNode('LLM');
      if (!node) throw new Error('Node should be created');
      graphStore.updateNodePosition(node.id, { x: 100, y: 100 });
    });

    const nodeEl = screen.getByTestId(`node-item-${node!.id}`);
    
    fireEvent.mouseDown(nodeEl, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 200 });
    fireEvent.mouseUp(window);

    const updatedNode = graphStore.getState().nodes.find(n => n.id === node!.id);
    expect(updatedNode?.position.x).toBe(150);
    expect(updatedNode?.position.y).toBe(200);
  });
});
