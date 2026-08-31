import React, { useCallback, useState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';

import { injectedConnector } from '../connectors/injectedConnector';
import { networkConnector } from '../connectors/networkconnector';
import Web3ConnectionProvider from './Web3ConnectionProvider';

vi.mock('@web3-react/core', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    useWeb3React: vi.fn()
  };
});

vi.mock('../connectors/injectedConnector', () => ({
  injectedConnector: {
    isAuthorized: vi.fn()
  }
}));

vi.mock('../connectors/networkconnector', () => ({
  networkConnector: { id: 'network' }
}));

vi.mock('../hooks/useInactiveListener', () => ({
  default: vi.fn()
}));

vi.mock('../utils/walletConnection', () => ({
  isInjectedWalletAutoConnectSuppressed: vi.fn(() => false)
}));

const ConnectionProbe = () => {
  const { active, error } = useWeb3React();

  return <div>{error?.name || (active ? 'active' : 'idle')}</div>;
};

describe('Web3ConnectionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('preserves an authorized wallet wrong-network error instead of activating the read-only connector', async () => {
    const activationCalls = [];
    const wrongNetworkError = new UnsupportedChainIdError(1, [11155111]);

    injectedConnector.isAuthorized.mockResolvedValue(true);

    const ConnectionHarness = () => {
      const [connection, setConnection] = useState({
        active: false,
        error: null
      });
      const activate = useCallback((connector, _onError, throwErrors = false) => {
        activationCalls.push(connector);

        if (connector === injectedConnector) {
          if (throwErrors) {
            return Promise.reject(wrongNetworkError);
          }

          setConnection({ active: false, error: wrongNetworkError });
          return Promise.resolve();
        }

        setConnection({ active: true, error: null });
        return Promise.resolve();
      }, []);
      const setError = useCallback((error) => {
        setConnection({ active: false, error });
      }, []);

      useWeb3React.mockImplementation(() => ({
        ...connection,
        activate,
        setError
      }));

      return (
        <Web3ConnectionProvider>
          <ConnectionProbe />
        </Web3ConnectionProvider>
      );
    };

    render(<ConnectionHarness />);

    await waitFor(() => {
      expect(screen.getByText('UnsupportedChainIdError')).toBeInTheDocument();
    });

    expect(activationCalls).toContain(injectedConnector);
    expect(activationCalls).not.toContain(networkConnector);
  });
});
