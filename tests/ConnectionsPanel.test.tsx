import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionsPanel } from '../src/components/ConnectionsPanel';
import { useGraphStore, graphStore } from '../src/store/graphStore';
import { Node, Edge } from '../src/types';

vi.mock('../src/store/graphStore', async () => {
  const actual = await vi.importActual('../src/store/graphStore');
  return {
    ...actual,
    useGraphStore: vi.fn(),
  };
});

describe('ConnectionsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state message 'No connections yet.' when edges array is empty", () => {
    vi.mocked(useGraphStore).mockReturnValue({
      selectedRunId: null,
    } as any);

    render(<ConnectionsPanel edges={[]} nodeMap={{}} />);

    expect(screen.getByText('Connections (Edges)')).toBeInTheDocument();
    expect(screen.getByText('No connections yet.')).toBeInTheDocument();
  });

  it('renders list of connections with node labels from nodeMap', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      selectedRunId: null,
    } as any);

    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const nodeMap: Record<string, Node> = {
      n1: {
        id: 'n1',
        type: 'LLM',
        position: { x: 0, y: 0 },
        data: { label: 'LLM Node 1', type: 'LLM' },
      },
      n2: {
        id: 'n2',
        type: 'Prompt',
        position: { x: 100, y: 100 },
        data: { label: 'Prompt Node 2', type: 'Prompt' },
      },
    };

    render(<ConnectionsPanel edges={edges} nodeMap={nodeMap} />);

    expect(screen.getByTestId('edge-item-e1')).toBeInTheDocument();
    expect(screen.getByText('LLM Node 1 → Prompt Node 2')).toBeInTheDocument();
  });

  it('falls back to edge source and target IDs when nodes are missing from nodeMap', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      selectedRunId: null,
    } as any);

    const edges: Edge[] = [{ id: 'e2', source: 'missing-src', target: 'missing-tgt' }];

    render(<ConnectionsPanel edges={edges} nodeMap={{}} />);

    expect(screen.getByTestId('edge-item-e2')).toBeInTheDocument();
    expect(screen.getByText('missing-src → missing-tgt')).toBeInTheDocument();
  });

  it('calls graphStore.removeEdge when remove button is clicked and selectedRunId is null', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      selectedRunId: null,
    } as any);

    const removeEdgeSpy = vi.spyOn(graphStore, 'removeEdge');
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];

    render(<ConnectionsPanel edges={edges} nodeMap={{}} />);

    const deleteBtn = screen.getByTestId('delete-edge-e1');
    fireEvent.click(deleteBtn);

    expect(removeEdgeSpy).toHaveBeenCalledWith('e1');
  });

  it('disables remove button and prevents edge removal when selectedRunId is non-null', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      selectedRunId: 'run-456',
    } as any);

    const removeEdgeSpy = vi.spyOn(graphStore, 'removeEdge');
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];

    render(<ConnectionsPanel edges={edges} nodeMap={{}} />);

    const deleteBtn = screen.getByTestId('delete-edge-e1');
    expect(deleteBtn).toBeDisabled();

    fireEvent.click(deleteBtn);

    expect(removeEdgeSpy).not.toHaveBeenCalled();
  });
});
