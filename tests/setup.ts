import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Register global ResizeObserver mock
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;
globalThis.ResizeObserver = ResizeObserverMock;

// Register global getBoundingClientRect mock
Element.prototype.getBoundingClientRect = function() {
  return {
    width: 120,
    height: 50,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
    toJSON() { return {}; }
  };
};

// Intercept window.fetch to prevent external network calls
window.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : (input as any).url || String(input);
  throw new Error(`External network call blocked: fetch to ${url}`);
};
