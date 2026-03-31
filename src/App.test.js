import React from 'react';

import { render, screen } from '@testing-library/react';

import App from './App';

jest.mock('@web3-react/core', () => ({
  UnsupportedChainIdError: class UnsupportedChainIdError extends Error {},
  useWeb3React: () => ({
    account: null,
    activate: jest.fn(),
    chainId: 1,
    deactivate: jest.fn(),
    error: null,
    library: null
  })
}));

jest.mock('./providers/Web3ConnectionProvider', () => ({
  __esModule: true,
  default: ({ children }) => children
}));

jest.mock('./providers/WrappedWeb3ReactProvider', () => ({
  __esModule: true,
  default: ({ children }) => children
}));

test('renders the bridge landing page', () => {
  render(React.createElement(App));
  const heading = screen.getByText(/Bridge assets securely/i);
  expect(heading).toBeInTheDocument();
});
