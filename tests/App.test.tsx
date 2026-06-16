import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../src/App';

describe('App component', () => {
  it('renders App correctly without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
