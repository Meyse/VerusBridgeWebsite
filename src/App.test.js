import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import App from './App';

vi.mock('@web3-react/core', () => ({
  UnsupportedChainIdError: class UnsupportedChainIdError extends Error {},
  useWeb3React: () => ({
    account: null,
    activate: vi.fn(),
    chainId: 1,
    deactivate: vi.fn(),
    error: null,
    library: null
  })
}));

vi.mock('./providers/Web3ConnectionProvider', () => ({
  __esModule: true,
  default: ({ children }) => children
}));

vi.mock('./providers/WrappedWeb3ReactProvider', () => ({
  __esModule: true,
  default: ({ children }) => children
}));

test('renders the bridge landing page with fail-closed search metadata', async () => {
  render(React.createElement(App));
  const heading = screen.getByText(/Bridge assets to Verus/i);
  expect(heading).toBeInTheDocument();
  await waitFor(() => {
    expect(document.title).toBe('Verus-Ethereum Bridge | Bridge Assets to Verus');
  });
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});
