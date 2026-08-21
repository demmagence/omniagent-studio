import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceControls } from '../src/components/WorkspaceControls';
import { graphStore } from '../src/store/graphStore';

describe('WorkspaceControls Component', () => {
  const defaultProps = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetView: vi.fn(),
    onFitToScreen: vi.fn(),
  };

  beforeEach(() => {
    graphStore.resetGraph();
    vi.clearAllMocks();
  });

  it('renders workspace controls panel and buttons', () => {
    render(<WorkspaceControls {...defaultProps} />);

    expect(screen.getByTestId('workspace-controls-panel')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-in-btn')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reset-view-btn')).toBeInTheDocument();
    expect(screen.getByTestId('fit-view-btn')).toBeInTheDocument();
    expect(screen.getByTestId('undo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('redo-btn')).toBeInTheDocument();
  });

  it('triggers onZoomIn callback when zoom-in button is clicked', () => {
    render(<WorkspaceControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);
  });

  it('triggers onZoomOut callback when zoom-out button is clicked', () => {
    render(<WorkspaceControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('triggers onResetView callback when reset-view button is clicked', () => {
    render(<WorkspaceControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId('reset-view-btn'));
    expect(defaultProps.onResetView).toHaveBeenCalledTimes(1);
  });

  it('triggers onFitToScreen callback when fit-view button is clicked', () => {
    render(<WorkspaceControls {...defaultProps} />);

    fireEvent.click(screen.getByTestId('fit-view-btn'));
    expect(defaultProps.onFitToScreen).toHaveBeenCalledTimes(1);
  });

  it('handles mouseover and mouseout styling changes on zoom and view buttons', () => {
    render(<WorkspaceControls {...defaultProps} />);

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    fireEvent.mouseOver(zoomInBtn);
    expect(zoomInBtn.style.backgroundColor).toBe('rgba(75, 85, 99, 0.4)');

    fireEvent.mouseOut(zoomInBtn);
    expect(zoomInBtn.style.backgroundColor).toBe('transparent');
  });

  it('disables undo and redo buttons when no actions in history', () => {
    render(<WorkspaceControls {...defaultProps} />);

    const undoBtn = screen.getByTestId('undo-btn') as HTMLButtonElement;
    const redoBtn = screen.getByTestId('redo-btn') as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  it('enables undo button when actions exist and calls graphStore.undo on click', () => {
    const undoSpy = vi.spyOn(graphStore, 'undo');

    // Add a node to create history
    graphStore.addNode('LLM');

    render(<WorkspaceControls {...defaultProps} />);

    const undoBtn = screen.getByTestId('undo-btn') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);

    fireEvent.mouseOver(undoBtn);
    expect(undoBtn.style.backgroundColor).toBe('rgba(59, 130, 246, 0.15)');

    fireEvent.click(undoBtn);
    expect(undoSpy).toHaveBeenCalledTimes(1);

    fireEvent.mouseOut(undoBtn);
    expect(undoBtn.style.backgroundColor).toBe('transparent');
  });

  it('enables redo button when undo action performed and calls graphStore.redo on click', () => {
    const redoSpy = vi.spyOn(graphStore, 'redo');

    // Add node and undo to populate redo stack
    graphStore.addNode('LLM');
    graphStore.undo();

    render(<WorkspaceControls {...defaultProps} />);

    const redoBtn = screen.getByTestId('redo-btn') as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(false);

    fireEvent.mouseOver(redoBtn);
    expect(redoBtn.style.backgroundColor).toBe('rgba(16, 185, 129, 0.15)');

    fireEvent.click(redoBtn);
    expect(redoSpy).toHaveBeenCalledTimes(1);

    fireEvent.mouseOut(redoBtn);
    expect(redoBtn.style.backgroundColor).toBe('transparent');
  });

  it('disables undo and redo buttons when a run ID is selected', () => {
    graphStore.addNode('LLM');
    graphStore.undo();
    graphStore.addRunToHistory({
      nodes: [],
      edges: [],
      traceSteps: [],
      status: 'success',
    });
    const runId = graphStore.getState().history[0].id;
    graphStore.selectRun(runId);

    render(<WorkspaceControls {...defaultProps} />);

    const undoBtn = screen.getByTestId('undo-btn') as HTMLButtonElement;
    const redoBtn = screen.getByTestId('redo-btn') as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });
});
