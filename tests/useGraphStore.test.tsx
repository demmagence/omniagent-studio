import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { graphStore, useGraphStore } from '../src/store/graphStore';

describe('useGraphStore hook', () => {
  beforeEach(() => {
    graphStore.resetGraph();
  });

  it('should return initial graphStore state', () => {
    const { result } = renderHook(() => useGraphStore());

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.nodeMap).toEqual({});
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.traceSteps).toEqual([]);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isFallbackMode).toBe(true);
    expect(result.current.history).toEqual([]);
    expect(result.current.selectedRunId).toBeNull();
    expect(result.current.maxConcurrency).toBe(3);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should update state when store changes via addNode, selectNode, and updateNodeData', () => {
    const { result } = renderHook(() => useGraphStore());

    let addedNode: ReturnType<typeof graphStore.addNode>;
    act(() => {
      addedNode = graphStore.addNode('LLM', { x: 50, y: 100 });
    });

    expect(result.current.nodes.length).toBe(1);
    expect(result.current.nodes[0].id).toBe(addedNode!.id);
    expect(result.current.nodeMap[addedNode!.id]).toBeDefined();

    act(() => {
      graphStore.selectNode(addedNode!.id);
    });

    expect(result.current.selectedNodeId).toBe(addedNode!.id);

    act(() => {
      graphStore.updateNodeData(addedNode!.id, { label: 'Updated LLM Label' });
    });

    expect(result.current.nodes[0].data.label).toBe('Updated LLM Label');
    expect(result.current.nodeMap[addedNode!.id].data.label).toBe('Updated LLM Label');
  });

  it('should unsubscribe from store updates on unmount', () => {
    const { result, unmount } = renderHook(() => useGraphStore());

    act(() => {
      graphStore.addNode('Prompt');
    });

    expect(result.current.nodes.length).toBe(1);

    const snapshotBeforeUnmount = result.current;

    unmount();

    act(() => {
      graphStore.addNode('Tool');
    });

    // The unmounted hook's result.current should remain unchanged
    expect(result.current).toBe(snapshotBeforeUnmount);
    expect(result.current.nodes.length).toBe(1);
  });
});
