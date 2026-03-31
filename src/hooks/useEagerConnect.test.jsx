import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import { useWeb3React } from '@web3-react/core';

import { injectedConnector } from '../connectors/injectedConnector';
import { isInjectedWalletAutoConnectSuppressed } from '../utils/walletConnection';
import useEagerConnect from './useEagerConnect';

jest.mock('@web3-react/core', () => ({
  useWeb3React: jest.fn()
}));

jest.mock('../connectors/injectedConnector', () => ({
  injectedConnector: {
    isAuthorized: jest.fn()
  }
}));

jest.mock('../utils/walletConnection', () => ({
  isInjectedWalletAutoConnectSuppressed: jest.fn()
}));

const HookProbe = () => {
  const tried = useEagerConnect();

  return <div>{tried ? 'tried' : 'pending'}</div>;
};

describe('useEagerConnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips eager connection after an explicit disconnect', async () => {
    const activate = jest.fn();

    useWeb3React.mockReturnValue({
      activate,
      active: false
    });
    isInjectedWalletAutoConnectSuppressed.mockReturnValue(true);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByText('tried')).toBeInTheDocument();
    });

    expect(injectedConnector.isAuthorized).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  test('checks connector authorization when auto-connect is allowed', async () => {
    const activate = jest.fn();

    useWeb3React.mockReturnValue({
      activate,
      active: false
    });
    isInjectedWalletAutoConnectSuppressed.mockReturnValue(false);
    injectedConnector.isAuthorized.mockResolvedValue(false);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByText('tried')).toBeInTheDocument();
    });

    expect(injectedConnector.isAuthorized).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });
});
