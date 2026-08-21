import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../src/App';
import { graphStore } from '../src/store/graphStore';

describe('ConfigPanel extra coverage', () => {
  beforeEach(() => {
    act(() => {
      graphStore.resetGraph();
    });
  });

  it('renders with missing label falling back to empty string', () => {
    render(<App />);
    let nodeId = '';
    act(() => {
      const node = graphStore.addNode('LLM');
      nodeId = node.id;
      graphStore.updateNodeData(nodeId, { label: undefined });
      graphStore.selectNode(nodeId);
    });
    const labelInput = screen.getByTestId('config-label-input') as HTMLInputElement;
    expect(labelInput.value).toBe('');
  });

  it('handles invalid similarity threshold', () => {
    render(<App />);
    let nodeId = '';
    act(() => {
      const node = graphStore.addNode('VectorDB');
      nodeId = node.id;
      graphStore.selectNode(nodeId);
    });
    const input = screen.getByTestId('config-similarity-threshold-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    expect(graphStore.getState().nodes[0].data.similarityThreshold).toBeUndefined();
  });
});
