import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Node } from '../src/components/Node';
import { graphStore } from '../src/store/graphStore';
import { Node as NodeType } from '../src/types';

describe('Node Component', () => {
  const mockNode: NodeType = {
    id: 'n1',
    type: 'LLM',
    position: { x: 10, y: 20 },
    data: { label: 'Node 1', type: 'LLM' }
  };

  const targetNode: NodeType = {
    id: 'n2',
    type: 'Prompt',
    position: { x: 100, y: 100 },
    data: { label: 'Node 2', type: 'Prompt' }
  };

  const allNodes: NodeType[] = [mockNode, targetNode];

  beforeEach(() => {
    graphStore.resetGraph();
    vi.restoreAllMocks();
  });

  it('renders basic node information and default status', () => {
    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
      />
    );

    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByText('Type: LLM')).toBeInTheDocument();
    expect(screen.getByTestId('node-status-n1')).toHaveTextContent('pending');
  });

  it('renders node status and corresponding border styles correctly', () => {
    const { rerender } = render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
        nodeStatus="running"
      />
    );

    const nodeElement = screen.getByTestId('node-item-n1');
    expect(nodeElement).toHaveStyle('border: 2px solid #f59e0b');
    expect(screen.getByTestId('node-status-n1')).toHaveTextContent('running');

    rerender(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
        nodeStatus="completed"
      />
    );
    expect(nodeElement).toHaveStyle('border: 2px solid #10b981');
    expect(screen.getByTestId('node-status-n1')).toHaveTextContent('completed');

    rerender(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
        nodeStatus="failed"
      />
    );
    expect(nodeElement).toHaveStyle('border: 2px solid #ef4444');
    expect(screen.getByTestId('node-status-n1')).toHaveTextContent('failed');

    rerender(
      <Node
        node={mockNode}
        isSelected={true}
        allNodes={allNodes}
      />
    );
    expect(nodeElement).toHaveStyle('border: 2px solid #3b82f6');

    rerender(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
      />
    );
    expect(nodeElement).toHaveStyle('border: 1px solid #4b5563');
  });

  it('triggers selectNode when container is clicked', () => {
    const selectSpy = vi.spyOn(graphStore, 'selectNode');
    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
      />
    );

    fireEvent.click(screen.getByTestId('node-item-n1'));
    expect(selectSpy).toHaveBeenCalledWith('n1');
  });

  it('triggers onStartDrag and onPortMouseDown callbacks', () => {
    const onStartDrag = vi.fn();
    const onPortMouseDown = vi.fn();

    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
        onStartDrag={onStartDrag}
        onPortMouseDown={onPortMouseDown}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('node-item-n1'));
    expect(onStartDrag).toHaveBeenCalledWith('n1', expect.anything());

    fireEvent.mouseDown(screen.getByTestId('port-in-n1'));
    expect(onPortMouseDown).toHaveBeenCalledWith('n1', 'in', expect.anything());

    fireEvent.mouseDown(screen.getByTestId('port-out-n1'));
    expect(onPortMouseDown).toHaveBeenCalledWith('n1', 'out', expect.anything());
  });

  it('removes node when delete button is clicked', () => {
    const removeSpy = vi.spyOn(graphStore, 'removeNode');
    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
      />
    );

    fireEvent.click(screen.getByTestId(`delete-node-${mockNode.id}`));
    expect(removeSpy).toHaveBeenCalledWith('n1');
  });

  it('connects node to target when dropdown option is selected and connect button is clicked', () => {
    const addEdgeSpy = vi.spyOn(graphStore, 'addEdge');
    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
      />
    );

    const select = screen.getByTestId(`connect-select-${mockNode.id}`);
    fireEvent.change(select, { target: { value: 'n2' } });

    const connectBtn = screen.getByTestId(`connect-btn-${mockNode.id}`);
    fireEvent.click(connectBtn);

    expect(addEdgeSpy).toHaveBeenCalledWith('n1', 'n2');
  });

  it('disables controls and prevents interactions in replay mode', () => {
    const removeSpy = vi.spyOn(graphStore, 'removeNode');
    const onPortMouseDown = vi.fn();

    // Enable replay mode by creating a run in history and selecting it
    graphStore.addRunToHistory({
      nodes: [mockNode],
      edges: [],
      traceSteps: [],
      status: 'success'
    });
    const runId = graphStore.getState().history[0].id;
    graphStore.selectRun(runId);

    render(
      <Node
        node={mockNode}
        isSelected={false}
        allNodes={allNodes}
        onPortMouseDown={onPortMouseDown}
      />
    );

    const deleteBtn = screen.getByTestId(`delete-node-${mockNode.id}`);
    const connectSelect = screen.getByTestId(`connect-select-${mockNode.id}`);
    const connectBtn = screen.getByTestId(`connect-btn-${mockNode.id}`);

    expect(deleteBtn).toBeDisabled();
    expect(connectSelect).toBeDisabled();
    expect(connectBtn).toBeDisabled();

    fireEvent.click(deleteBtn);
    expect(removeSpy).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByTestId('port-in-n1'));
    expect(onPortMouseDown).not.toHaveBeenCalled();
  });
});
