import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Sidebar } from '../src/components/Sidebar';
import { graphStore } from '../src/store/graphStore';

describe('Concurrency Clamping', () => {
  beforeEach(() => {
    graphStore.resetGraph();
  });

  it('clamps maxConcurrency to 1 if user enters a value less than 1', () => {
    render(<Sidebar />);
    const input = screen.getByTestId('max-concurrency-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0' } });
    expect(graphStore.getState().maxConcurrency).toBe(1);

    fireEvent.change(input, { target: { value: '-5' } });
    expect(graphStore.getState().maxConcurrency).toBe(1);
  });

  it('clamps maxConcurrency to 10 if user enters a value greater than 10', () => {
    render(<Sidebar />);
    const input = screen.getByTestId('max-concurrency-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '11' } });
    expect(graphStore.getState().maxConcurrency).toBe(10);

    fireEvent.change(input, { target: { value: '100' } });
    expect(graphStore.getState().maxConcurrency).toBe(10);
  });

  it('allows values between 1 and 10', () => {
    render(<Sidebar />);
    const input = screen.getByTestId('max-concurrency-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '5' } });
    expect(graphStore.getState().maxConcurrency).toBe(5);

    fireEvent.change(input, { target: { value: '1' } });
    expect(graphStore.getState().maxConcurrency).toBe(1);

    fireEvent.change(input, { target: { value: '10' } });
    expect(graphStore.getState().maxConcurrency).toBe(10);
  });

  it('graphStore.setMaxConcurrency also clamps values', () => {
    graphStore.setMaxConcurrency(0);
    expect(graphStore.getState().maxConcurrency).toBe(1);

    graphStore.setMaxConcurrency(15);
    expect(graphStore.getState().maxConcurrency).toBe(10);

    graphStore.setMaxConcurrency(7);
    expect(graphStore.getState().maxConcurrency).toBe(7);
  });
});
