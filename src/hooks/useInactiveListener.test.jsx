import React from 'react';

import { render, screen } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';

import { getConnectorForWallet, resetConnectorsForTests } from 'connectors/eip1193Connector';
import WalletProvider from 'providers/WalletProvider';
import {
  announceWallet,
  createBraveWalletProxyProvider,
  createEip1193Provider
} from 'testUtils/walletFixtures';
import { REMEMBERED_WALLET_RDNS_KEY } from 'utils/walletConnection';
import { resetWalletDiscoveryForTests } from 'wallets/useWalletDiscovery';
import { resetWalletSessionForTests } from 'wallets/walletSession';

import useInactiveListener from './useInactiveListener';

vi.mock('@web3-react/core', () => ({
  useWeb3React: vi.fn()
}));

const HookProbe = () => {
  useInactiveListener();

  return <div>page</div>;
};

const renderProbe = () => render(
  <WalletProvider>
    <HookProbe />
  </WalletProvider>
);

describe('useInactiveListener', () => {
  let activate;
  let installed;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetWalletDiscoveryForTests();
    resetConnectorsForTests();
    resetWalletSessionForTests();
    installed = [];
    activate = vi.fn();
    useWeb3React.mockReturnValue({ activate, active: false, error: undefined });
  });

  afterEach(() => {
    installed.forEach((wallet) => wallet.remove());
    delete window.ethereum;
  });

  const install = (wallet) => {
    const entry = announceWallet(wallet);
    installed.push(entry);
    return entry;
  };

  test('keeps the page rendered when window.ethereum throws, and listens on the announced Brave Wallet', () => {
    window.ethereum = createBraveWalletProxyProvider();
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'com.brave.wallet');
    const brave = install({ name: 'Brave Wallet', rdns: 'com.brave.wallet', uuid: 'brave-1' });

    renderProbe();

    expect(screen.getByText('page')).toBeInTheDocument();
    expect(brave.provider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
  });

  test('reconnects the remembered wallet with its own connector, and removes the listener on unmount', () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    const metaMask = install({ name: 'MetaMask', rdns: 'io.metamask', uuid: 'metamask-1' });

    const { unmount } = renderProbe();
    metaMask.provider.emit('accountsChanged', ['0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf']);

    expect(activate).toHaveBeenCalledWith(getConnectorForWallet({ ...metaMask.info, id: 'metamask-1' }));
    expect(metaMask.provider.listenerCount('accountsChanged')).toBe(1);
    expect(metaMask.provider.on).not.toHaveBeenCalledWith('networkChanged', expect.any(Function));

    unmount();
    expect(metaMask.provider.listenerCount('accountsChanged')).toBe(0);
  });

  test('does not listen when two wallet entries share the remembered rdns', () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    const first = install({ name: 'MetaMask', rdns: 'io.metamask', uuid: 'metamask-1' });
    const second = install({
      name: 'MetaMask', provider: createEip1193Provider(), rdns: 'io.metamask', uuid: 'metamask-2'
    });

    renderProbe();

    expect(first.provider.on).not.toHaveBeenCalled();
    expect(second.provider.on).not.toHaveBeenCalled();
  });
});
