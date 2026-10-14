import React from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';

import { getConnectorForWallet, resetConnectorsForTests } from 'connectors/eip1193Connector';
import WalletProvider, { useWalletContext } from 'providers/WalletProvider';
import { announceWallet, createEip1193Provider } from 'testUtils/walletFixtures';
import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, REMEMBERED_WALLET_RDNS_KEY } from 'utils/walletConnection';
import { resetWalletDiscoveryForTests } from 'wallets/useWalletDiscovery';
import { resetWalletSessionForTests } from 'wallets/walletSession';

import useEagerConnect from './useEagerConnect';

vi.mock('@web3-react/core', () => ({
  useWeb3React: vi.fn()
}));

const ACCOUNT = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
let context;

const HookProbe = () => {
  const tried = useEagerConnect();
  context = useWalletContext();

  return <div>{tried ? 'tried' : 'pending'}</div>;
};

const renderProbe = () => render(
  <WalletProvider>
    <HookProbe />
  </WalletProvider>
);

describe('useEagerConnect', () => {
  let activate;
  let installed;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetWalletDiscoveryForTests();
    resetConnectorsForTests();
    resetWalletSessionForTests();
    installed = [];
    activate = vi.fn().mockResolvedValue(undefined);
    useWeb3React.mockReturnValue({ activate, active: false, setError: vi.fn() });
  });

  afterEach(() => {
    installed.forEach((wallet) => wallet.remove());
  });

  const install = (name, rdns, uuid, accounts = [ACCOUNT]) => {
    const entry = announceWallet({
      name, provider: createEip1193Provider({ accounts }), rdns, uuid
    });
    installed.push(entry);
    return { ...entry.info, id: uuid, provider: entry.provider };
  };

  test('reconnects a remembered wallet that announced before discovery settled', async () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    const metaMask = install('MetaMask', 'io.metamask', 'metamask-1');
    install('Brave Wallet', 'com.brave.wallet', 'brave-1');

    renderProbe();

    await waitFor(() => {
      expect(activate).toHaveBeenCalledWith(getConnectorForWallet(metaMask), undefined, true);
    });
    expect(activate).toHaveBeenCalledTimes(1);
  });

  test('does not connect when two entries have the remembered rdns', async () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    install('MetaMask', 'io.metamask', 'metamask-1');
    install('MetaMask', 'io.metamask', 'metamask-2');

    renderProbe();

    expect(await screen.findByText('tried', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });

  test('does not guess between two authorized wallets when none is remembered', async () => {
    install('MetaMask', 'io.metamask', 'metamask-1');
    install('Brave Wallet', 'com.brave.wallet', 'brave-1');

    renderProbe();

    expect(await screen.findByText('tried', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });

  test('connects the only authorized wallet when none is remembered', async () => {
    install('MetaMask', 'io.metamask', 'metamask-1', []);
    const brave = install('Brave Wallet', 'com.brave.wallet', 'brave-1');

    renderProbe();

    await waitFor(() => {
      expect(activate).toHaveBeenCalledWith(getConnectorForWallet(brave), undefined, true);
    });
  });

  test('never opens a prompt for a remembered wallet that has not authorized the site', async () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    install('MetaMask', 'io.metamask', 'metamask-1', []);

    renderProbe();

    expect(await screen.findByText('tried', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });

  test('skips eager connection after an explicit disconnect', async () => {
    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    install('MetaMask', 'io.metamask', 'metamask-1');

    renderProbe();

    expect(await screen.findByText('tried')).toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });

  test('a manual connect during eager connect wins', async () => {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, 'io.metamask');
    install('MetaMask', 'io.metamask', 'metamask-1');
    const brave = install('Brave Wallet', 'com.brave.wallet', 'brave-1');

    renderProbe();
    await act(async () => {
      await context.connect('brave-1');
    });

    expect(await screen.findByText('tried', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(getConnectorForWallet(brave));
  });
});
