import { useEffect, useMemo } from 'react';

import { useWeb3React } from '@web3-react/core';

import { useToast } from 'components/Toast/ToastProvider';
import { getConnectorForWallet } from 'connectors/eip1193Connector';
import { useWalletContext } from 'providers/WalletProvider';
import { isInjectedWalletAutoConnectSuppressed } from 'utils/walletConnection';

// Some wallets block reading or calling `on` (Brave 1.94+ does this on
// window.ethereum, brave/brave-browser#58890). Never let that unmount the app.
const canListenToProviderEvents = (provider) => {
  try {
    return typeof provider?.on === 'function';
  } catch (error) {
    return false;
  }
};

// While no wallet is connected, listen to the remembered wallet's provider, and
// reconnect it when it reports a connection, a network, or an account (plan B5).
const useInactiveListener = (suppress = false) => {
  const { active, error, activate } = useWeb3React();
  const { rememberedRdns, wallets } = useWalletContext();
  const { addToast } = useToast();

  const rememberedWallet = useMemo(() => {
    const matches = wallets.filter((wallet) => wallet.rdns === rememberedRdns);
    return matches.length === 1 ? matches[0] : null;
  }, [rememberedRdns, wallets]);

  useEffect(() => {
    const provider = rememberedWallet?.provider;

    if (
      !rememberedWallet
      || active
      || error
      || suppress
      || isInjectedWalletAutoConnectSuppressed()
      || !canListenToProviderEvents(provider)
    ) {
      return undefined;
    }

    const connector = getConnectorForWallet(rememberedWallet);
    const handleConnect = () => {
      addToast({ type: 'info', description: 'connected to wallet' });
      activate(connector);
    };
    const handleChainChanged = () => {
      addToast({ type: 'info', description: 'Chain changed!' });
      activate(connector);
    };
    const handleAccountsChanged = (accounts) => {
      addToast({ type: 'info', description: 'Account changed!' });
      if (Array.isArray(accounts) && accounts.length > 0) {
        activate(connector);
      }
    };
    const subscriptions = [
      ['connect', handleConnect],
      ['chainChanged', handleChainChanged],
      ['accountsChanged', handleAccountsChanged]
    ];
    const added = [];

    try {
      subscriptions.forEach(([event, handler]) => {
        provider.on(event, handler);
        added.push([event, handler]);
      });
    } catch (subscribeError) {
      // Fall through to the cleanup below with the listeners that were added.
    }

    return () => {
      added.forEach(([event, handler]) => {
        try {
          provider.removeListener(event, handler);
        } catch (removeError) {
          // A wallet can block removeListener. Nothing else to do.
        }
      });
    };
  }, [active, activate, addToast, error, rememberedWallet, suppress]);

  return null;
};

export default useInactiveListener;
