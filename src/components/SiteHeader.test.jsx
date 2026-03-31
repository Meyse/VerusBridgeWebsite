import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useWeb3React } from '@web3-react/core';

import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY } from 'utils/walletConnection';

import SiteHeader from './SiteHeader';

jest.mock('@web3-react/core', () => ({
  UnsupportedChainIdError: class UnsupportedChainIdError extends Error {},
  useWeb3React: jest.fn()
}));

jest.mock('@web3-react/injected-connector', () => ({
  NoEthereumProviderError: class NoEthereumProviderError extends Error {},
  UserRejectedRequestError: class UserRejectedRequestError extends Error {}
}));

jest.mock('config/explorerLinks', () => ({
  getExplorerBaseUrl: () => 'https://etherscan.io'
}));

jest.mock('connectors/injectedConnector', () => ({
  injectedConnector: { id: 'injected' }
}));

const mockAddToast = jest.fn();

jest.mock('./Toast/ToastProvider', () => ({
  useToast: () => ({ addToast: mockAddToast })
}));

jest.mock('./WalletConnectDialog', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, onConfirm }) => (
    isOpen ? (
      <div role="dialog">
        <button onClick={onClose} type="button">
          Cancel
        </button>
        <button onClick={onConfirm} type="button">
          Select
        </button>
      </div>
    ) : null
  )
}));

const renderHeader = () => render(
  <MemoryRouter>
    <SiteHeader />
  </MemoryRouter>
);

describe('SiteHeader wallet interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  test('stores the disconnect preference before deactivating the wallet', () => {
    const deactivate = jest.fn();

    useWeb3React.mockReturnValue({
      account: '0x1234567890123456789012345678901234567890',
      activate: jest.fn(),
      deactivate,
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /0x1234/i }));
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBe('true');
  });

  test('clears the disconnect preference after a successful manual connect', async () => {
    const activate = jest.fn().mockResolvedValue(undefined);

    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /select/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(activate).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBeNull();
  });

  test('closes the wallet dialog when connector activation fails', async () => {
    const activate = jest.fn().mockRejectedValue(new Error('Connection rejected'));

    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /select/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(activate).toHaveBeenCalledTimes(1);
  });
});
