import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TracingConsole } from '../src/components/TracingConsole';
import { useGraphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';

vi.mock('../src/store/graphStore', () => ({
  useGraphStore: vi.fn(),
}));

vi.mock('../src/services/executor', () => ({
  executeWorkflow: vi.fn(),
}));

describe('TracingConsole', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial state with no trace steps', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [],
      isRunning: false,
      nodes: [],
      selectedRunId: null,
    } as any);

    render(<TracingConsole />);
    expect(screen.getByTestId('tracing-console')).toBeInTheDocument();
    expect(screen.getByText('Execution Tracing Console')).toBeInTheDocument();
    expect(screen.getByText('No trace steps. Hit "Run Workflow" to execute.')).toBeInTheDocument();

    const runBtn = screen.getByTestId('run-workflow-btn');
    expect(runBtn).toBeDisabled();
    expect(runBtn).toHaveTextContent('Run Workflow');
  });

  it('enables run button when nodes are present and not running', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [],
      isRunning: false,
      nodes: [{ id: 'node-1', data: { label: 'Node 1' } }], nodeMap: { 'node-1': { id: 'node-1', data: { label: 'Node 1' } } },
      selectedRunId: null,
    } as any);

    render(<TracingConsole />);
    const runBtn = screen.getByTestId('run-workflow-btn');
    expect(runBtn).not.toBeDisabled();
  });

  it('disables run button and shows running text when isRunning is true', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [],
      isRunning: true,
      nodes: [{ id: 'node-1', data: { label: 'Node 1' } }], nodeMap: { 'node-1': { id: 'node-1', data: { label: 'Node 1' } } },
      selectedRunId: null,
    } as any);

    render(<TracingConsole />);
    const runBtn = screen.getByTestId('run-workflow-btn');
    expect(runBtn).toBeDisabled();
    expect(runBtn).toHaveTextContent('Running...');
  });

  it('renders trace steps and execution stats correctly', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [
        { nodeId: 'node-1', status: 'completed', tokensConsumed: 10, log: 'Done', input: { a: 1 }, output: { b: 2 } },
        { nodeId: 'node-2', status: 'failed', tokensConsumed: 5, log: 'Error' },
        { nodeId: 'node-3', status: 'pending' },
        { nodeId: 'node-4', status: 'running' },
      ],
      isRunning: false,
      nodes: [
        { id: 'node-1', data: { label: 'Node 1' } },
        { id: 'node-2', data: { label: 'Node 2' } },
      ],
      nodeMap: {
        'node-1': { id: 'node-1', data: { label: 'Node 1' } },
        'node-2': { id: 'node-2', data: { label: 'Node 2' } },
      },
      selectedRunId: null,
    } as any);

    render(<TracingConsole />);

    expect(screen.getByTestId('execution-stats')).toBeInTheDocument();
    expect(screen.getByTestId('stats-completed')).toHaveTextContent('1');
    expect(screen.getByTestId('stats-failed')).toHaveTextContent('1');
    expect(screen.getByTestId('stats-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('stats-running')).toHaveTextContent('1');
    expect(screen.getByTestId('total-tokens')).toHaveTextContent('15');

    expect(screen.getByTestId('trace-step-node-1')).toBeInTheDocument();
    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByTestId('trace-status-node-1')).toHaveTextContent('COMPLETED');
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
    expect(screen.getByText('{"b":2}')).toBeInTheDocument();

    expect(screen.getByTestId('trace-step-node-2')).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
    expect(screen.getByTestId('trace-status-node-2')).toHaveTextContent('FAILED');
    expect(screen.getByText('Error')).toBeInTheDocument();

    // nodes without data in nodes array
    expect(screen.getByTestId('trace-step-node-3')).toBeInTheDocument();
    expect(screen.getByText('node-3')).toBeInTheDocument(); // fallback to id
  });

  it('displays error when executeWorkflow fails', async () => {
    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [],
      isRunning: false,
      nodes: [{ id: 'node-1', data: { label: 'Node 1' } }], nodeMap: { 'node-1': { id: 'node-1', data: { label: 'Node 1' } } },
      selectedRunId: null,
    } as any);

    vi.mocked(executeWorkflow).mockRejectedValueOnce(new Error('Execution failed!'));

    render(<TracingConsole />);

    const runBtn = screen.getByTestId('run-workflow-btn');

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('execution-error')).toBeInTheDocument();
      expect(screen.getByText(/Execution failed!/)).toBeInTheDocument();
    });
  });

  it('updates elapsed time while running', async () => {
    vi.useFakeTimers();

    vi.mocked(useGraphStore).mockReturnValue({
      traceSteps: [{ nodeId: 'n1', status: 'running' }],
      isRunning: true,
      nodes: [{ id: 'node-1', data: { label: 'Node 1' } }], nodeMap: { 'node-1': { id: 'node-1', data: { label: 'Node 1' } } },
      selectedRunId: null,
    } as any);

    const { unmount, rerender } = render(<TracingConsole />);

    expect(screen.getByTestId('stats-elapsed')).toHaveTextContent('0.00s');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId('stats-elapsed')).toHaveTextContent('0.10s');

    const storeObj = {
      traceSteps: [{ nodeId: 'n1', status: 'completed' }],
      isRunning: false,
      nodes: [{ id: 'node-1', data: { label: 'Node 1' } }], nodeMap: { 'node-1': { id: 'node-1', data: { label: 'Node 1' } } },
      selectedRunId: null,
    };

    vi.mocked(useGraphStore).mockReturnValue(storeObj as any);

    rerender(<TracingConsole />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId('stats-elapsed')).toHaveTextContent('0.10s'); // Should be cleared and frozen at 0.10

    unmount();
  });
});
