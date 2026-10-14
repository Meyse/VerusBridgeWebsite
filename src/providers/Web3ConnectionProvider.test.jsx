import React, { useCallback, useState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';

import { getConnectorForWallet, resetConnectorsForTests } from 'connectors/eip1193Connector';
import { announceWallet, createEip1193Provider } from 'testUtils/walletFixtures';
import { REMEMBERED_WALLET_RDNS_KEY } from 'utils/walletConnection';
import { resetWalletDiscoveryForTests } from 'wallets/useWalletDiscovery';
import { resetWalletSessionForTests } from 'wallets/walletSession';

import { networkConnector } from '../connectors/networkconnector';
import WalletProvider from './WalletProvider';
import Web3ConnectionProvider from './Web3ConnectionProvider';

vi.mock('@web3-react/core', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    useWeb3React: vi.fn()
  };
});

vi.mock('../connectors/networkconnector', () => ({
  networkConnector: { id: 'network' }
}));

vi.mock('../hooks/useInactiveListener', () => ({
  default: vi.fn()
}));

const ConnectionProbe = () => {
  const { active, error } = useWeb3React();

  return <div>{error?.name || (active ? 'active' : 'idle')}</div>;
};

describe('Web3ConnectionProvider', () => {
  let installed;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetWalletDiscoveryForTests();
    resetConnectorsForTests();
    resetWalletSessionForTests();
    installed = null;
  });

  afterEach(() => {
    installed?.remove();
  });

  test('preserves an authorized wallet wrong-network error instead of activating the read-only connector', async () => {
    const activationCalls = [];
    const wrongNetworkError = new UnsupportedChainIdError(1, [11155111]);
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    installed = announceWallet({
      name: 'MetaMask',
      provider: createEip1193Provider({ accounts: ['0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf'] }),
      rdns: 'io.metamask',
      uuid: 'metamask-1'
    });
    const walletConnector = getConnectorForWallet({ ...installed.info, id: 'metamask-1', provider: installed.provider });

    const ConnectionHarness = () => {
      const [connection, setConnection] = useState({ active: false, error: null });
      const activate = useCallback((connector, _onError, throwErrors = false) => {
        activationCalls.push(connector);

        if (connector === walletConnector) {
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
        <WalletProvider>
          <Web3ConnectionProvider>
            <ConnectionProbe />
          </Web3ConnectionProvider>
        </WalletProvider>
      );
    };

    render(<ConnectionHarness />);

    await waitFor(() => {
      expect(screen.getByText('UnsupportedChainIdError')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(activationCalls).toContain(walletConnector);
    expect(activationCalls).not.toContain(networkConnector);
  });
});
