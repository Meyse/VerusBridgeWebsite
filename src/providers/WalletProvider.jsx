import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';

import { useWeb3React } from '@web3-react/core';

import { Eip1193Connector, getConnectorForWallet } from 'connectors/eip1193Connector';
import {
  clearInjectedWalletAutoConnectSuppression,
  getRememberedWalletRdns,
  setRememberedWalletRdns,
  suppressInjectedWalletAutoConnect
} from 'utils/walletConnection';
import useWalletDiscovery from 'wallets/useWalletDiscovery';
import { invalidateWalletSession, syncWalletSession } from 'wallets/walletSession';

const WalletContext = createContext(null);

// D8: entries that match the remembered rdns first, then by name (A to Z).
export const sortWallets = (wallets, rememberedRdns) => [...wallets].sort((left, right) => {
  const leftRemembered = left.rdns === rememberedRdns ? 0 : 1;
  const rightRemembered = right.rdns === rememberedRdns ? 0 : 1;

  if (leftRemembered !== rightRemembered) {
    return leftRemembered - rightRemembered;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
});

const getConnectedWallet = (connector, active) => (
  active && connector instanceof Eip1193Connector ? connector.wallet : null
);

export const WalletProvider = ({ children }) => {
  const { account, activate, active, chainId, connector, deactivate, error } = useWeb3React();
  const { settled, wallets } = useWalletDiscovery();
  const [rememberedRdns, setRememberedRdns] = useState(getRememberedWalletRdns);
  const [attemptedWallet, setAttemptedWallet] = useState(null);
  const [pendingWalletId, setPendingWalletId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const manualConnectRef = useRef({ started: false });

  const sortedWallets = useMemo(() => sortWallets(wallets, rememberedRdns), [rememberedRdns, wallets]);
  const connectedWallet = getConnectedWallet(connector, active);

  // G3: web3-react reports another connector, account, chain, or provider.
  useEffect(() => {
    syncWalletSession({
      account: connectedWallet ? account : null,
      chainId: connectedWallet ? chainId : null,
      connector: connectedWallet ? connector : null,
      provider: connectedWallet ? connector.provider : null,
      wallet: connectedWallet
    });
  }, [account, chainId, connectedWallet, connector]);

  // D14: a connection is successful only when web3-react reports `active` with
  // that wallet's connector. Remember the wallet only then.
  useEffect(() => {
    if (!connectedWallet) {
      return;
    }

    setRememberedWalletRdns(connectedWallet.rdns);
    setRememberedRdns(connectedWallet.rdns);
    clearInjectedWalletAutoConnectSuppression();
    setPendingWalletId((currentId) => (currentId === connectedWallet.id ? null : currentId));
    setPickerOpen(false);
  }, [connectedWallet]);

  // A rejected or failed connection ends the waiting row.
  useEffect(() => {
    if (error) {
      setPendingWalletId(null);
    }
  }, [error]);

  const connect = useCallback(async (walletId) => {
    const wallet = wallets.find((entry) => entry.id === walletId);
    if (!wallet) {
      return;
    }

    // D15: a manual connect cancels eager connect.
    manualConnectRef.current.started = true;
    invalidateWalletSession();
    setAttemptedWallet(wallet);
    setPendingWalletId(wallet.id);
    await activate(getConnectorForWallet(wallet));
  }, [activate, wallets]);

  const disconnect = useCallback(() => {
    invalidateWalletSession();
    suppressInjectedWalletAutoConnect();
    deactivate();
  }, [deactivate]);

  // D10: wallet calls use the pinned wallet provider, never the read-only
  // network connector. After a failed eager connect, the attempted wallet
  // still receives the network switch.
  const getActiveProvider = useCallback(() => {
    if (connector instanceof Eip1193Connector) {
      return connector.provider;
    }

    return attemptedWallet?.provider || null;
  }, [attemptedWallet, connector]);

  const value = useMemo(() => ({
    attemptedWallet,
    closePicker: () => setPickerOpen(false),
    connect,
    connectedWallet,
    disconnect,
    getActiveProvider,
    manualConnectRef,
    openPicker: () => setPickerOpen(true),
    pendingWalletId,
    pickerOpen,
    rememberedRdns,
    setAttemptedWallet,
    setPickerOpen,
    settled,
    wallets: sortedWallets
  }), [
    attemptedWallet,
    connect,
    connectedWallet,
    disconnect,
    getActiveProvider,
    pendingWalletId,
    pickerOpen,
    rememberedRdns,
    settled,
    sortedWallets
  ]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

// For hooks that also run outside the provider, for example in unit tests of a
// controller. Returns null there.
export const useOptionalWalletContext = () => useContext(WalletContext);

export const useWalletContext = () => {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWalletContext must be used inside WalletProvider.');
  }

  return context;
};

export default WalletProvider;
