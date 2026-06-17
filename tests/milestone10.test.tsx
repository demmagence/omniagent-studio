import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';
import { executeWorkflow } from '../src/services/executor';
import * as apiModule from '../src/services/api';

describe('Milestone 10: Execution History & Replay State', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('verifies run history auto-saving on workflow completion', async () => {
    // Mock callLLM to succeed
    vi.spyOn(apiModule, 'callLLM').mockResolvedValue({
      text: 'LLM Result text',
      tokensUsed: 15
    });

    let llmNodeId = '';
    act(() => {
      const node = graphStore.addNode('LLM');
      llmNodeId = node.id;
      graphStore.updateNodeData(llmNodeId, { provider: 'openai', model: 'gpt-4o' });
    });

    expect(graphStore.getState().history.length).toBe(0);

    // Run workflow successfully
    await executeWorkflow({ fallback: false });

    // History should have 1 entry
    const history = graphStore.getState().history;
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('success');
    expect(history[0].nodes.length).toBe(1);
    expect(history[0].nodes[0].id).toBe(llmNodeId);
    expect(history[0].traceSteps.length).toBe(1);
    expect(history[0].traceSteps[0].status).toBe('completed');
    expect(history[0].traceSteps[0].tokensConsumed).toBe(15);

    // Run a workflow with cycle to verify failure saving
    let promptNodeId = '';
    act(() => {
      const promptNode = graphStore.addNode('Prompt');
      promptNodeId = promptNode.id;
      // LLM -> Prompt
      graphStore.addEdge(llmNodeId, promptNodeId);
      // Prompt -> LLM (creates cycle)
      graphStore.addEdge(promptNodeId, llmNodeId);
    });

    await expect(executeWorkflow()).rejects.toThrow();

    // History should now have 2 entries
    const updatedHistory = graphStore.getState().history;
    expect(updatedHistory.length).toBe(2);
    expect(updatedHistory[1].status).toBe('failure');
    expect(updatedHistory[1].traceSteps[0].status).toBe('failed');
  });

  it('verifies selecting a run displays highlights, status badges, and logs/tokens in the console', async () => {
    vi.spyOn(apiModule, 'callLLM').mockResolvedValue({
      text: 'LLM output text',
      tokensUsed: 25
    });

    render(<App />);

    // Add node
    const addLlmBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(addLlmBtn);

    const nodes = graphStore.getState().nodes;
    const llmNodeId = nodes[0].id;

    // Run workflow via Run Button
    const runBtn = screen.getByTestId('run-workflow-btn');
    fireEvent.click(runBtn);

    // Wait for execution to finish
    await waitFor(() => {
      expect(graphStore.getState().history.length).toBe(1);
    });

    const runId = graphStore.getState().history[0].id;
    const historyEntry = screen.getByTestId(`history-entry-${runId}`);
    expect(historyEntry).toBeInTheDocument();

    // Select the run to trigger replay mode
    fireEvent.click(historyEntry);

    // Check that we are in replay mode
    expect(graphStore.getState().selectedRunId).toBe(runId);
    expect(screen.getByText('Replay Mode Active')).toBeInTheDocument();

    // Check status badge renders
    const statusBadge = screen.getByTestId(`node-status-${llmNodeId}`);
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge.textContent?.toLowerCase()).toBe('completed');

    // Check border styling (emerald/green border color '#10b981' / box shadow)
    const nodeEl = screen.getByTestId(`node-item-${llmNodeId}`);
    const normalizedBorder = nodeEl.style.border.toLowerCase().replace(/\s+/g, '');
    const normalizedBoxShadow = nodeEl.style.boxShadow.toLowerCase().replace(/\s+/g, '');
    const greenColorPattern = /(#10b981|rgba?\(16,185,129(?:,1)?\))/;
    expect(normalizedBorder).toMatch(greenColorPattern);
    expect(normalizedBoxShadow).toMatch(greenColorPattern);

    // Check console tokens and logs
    const totalTokensEl = screen.getByTestId('total-tokens');
    expect(totalTokensEl.textContent).toBe('25');

    const traceStepEl = screen.getByTestId(`trace-step-${llmNodeId}`);
    expect(traceStepEl).toBeInTheDocument();
    expect(traceStepEl.textContent).toContain('25');

    // Disables verify
    // 1. Add node button should be disabled
    expect(screen.getByTestId('add-node-Prompt')).toBeDisabled();
    // 2. Delete node button should be disabled
    expect(screen.getByTestId(`delete-node-${llmNodeId}`)).toBeDisabled();
    // 3. Reset workspace button should be disabled
    expect(screen.getByTestId('reset-btn')).toBeDisabled();
    // 4. Import button should be disabled
    expect(screen.getByTestId('import-btn')).toBeDisabled();
    // 5. Connect select & button should be disabled
    expect(screen.getByTestId(`connect-select-${llmNodeId}`)).toBeDisabled();
    expect(screen.getByTestId(`connect-btn-${llmNodeId}`)).toBeDisabled();

    // Deselect the run
    fireEvent.click(historyEntry);
    expect(graphStore.getState().selectedRunId).toBeNull();
    expect(screen.queryByText('Replay Mode Active')).not.toBeInTheDocument();
  });

  it('verifies backing up the active workspace draft during replay and restoring it on exit', async () => {
    vi.spyOn(apiModule, 'callLLM').mockResolvedValue({
      text: 'LLM Result text',
      tokensUsed: 10
    });

    // 1. Create a workspace and run it to create a history entry
    act(() => {
      graphStore.addNode('LLM');
    });

    await executeWorkflow({ fallback: false });
    const originalRunId = graphStore.getState().history[0].id;

    // 2. Now edit the live workspace (add a node that is NOT in the run history)
    let newNodeId = '';
    act(() => {
      const node = graphStore.addNode('Prompt');
      newNodeId = node.id;
    });

    // Verify workspace has 2 nodes currently
    expect(graphStore.getState().nodes.length).toBe(2);

    // 3. Enter replay mode by selecting the run
    act(() => {
      graphStore.selectRun(originalRunId);
    });

    // The active workspace state in store should now represent the historical run (1 node only)
    expect(graphStore.getState().nodes.length).toBe(1);
    expect(graphStore.getState().nodes.some(n => n.id === newNodeId)).toBe(false);

    // 4. Exit replay mode
    act(() => {
      graphStore.selectRun(null);
    });

    // The draft should be restored, back to 2 nodes
    expect(graphStore.getState().nodes.length).toBe(2);
    expect(graphStore.getState().nodes.some(n => n.id === newNodeId)).toBe(true);
  });

  it('verifies clearing history', async () => {
    vi.spyOn(apiModule, 'callLLM').mockResolvedValue({
      text: 'LLM Result text',
      tokensUsed: 5
    });

    render(<App />);

    // Add node and execute to populate history
    const addLlmBtn = screen.getByTestId('add-node-LLM');
    fireEvent.click(addLlmBtn);
    const runBtn = screen.getByTestId('run-workflow-btn');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(graphStore.getState().history.length).toBe(1);
    });

    const runId = graphStore.getState().history[0].id;
    
    // Select it to enter replay
    act(() => {
      graphStore.selectRun(runId);
    });
    expect(graphStore.getState().selectedRunId).toBe(runId);

    // Click clear history button
    const clearHistoryBtn = screen.getByTestId('clear-history-btn');
    fireEvent.click(clearHistoryBtn);

    // History should be empty and replay mode should be exited
    expect(graphStore.getState().history.length).toBe(0);
    expect(graphStore.getState().selectedRunId).toBeNull();
  });
});
