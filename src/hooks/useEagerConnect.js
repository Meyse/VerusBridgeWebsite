import { useEffect, useRef, useState } from 'react';

import { useWeb3React } from '@web3-react/core';

import { getConnectorForWallet } from 'connectors/eip1193Connector';
import { useWalletContext } from 'providers/WalletProvider';
import { isInjectedWalletAutoConnectSuppressed } from 'utils/walletConnection';

// Picks the wallet to reconnect without a prompt, or null (plan D6, D7).
// - A remembered rdns reconnects only when exactly one entry has it.
// - Without one, connect only when exactly one supported wallet already
//   reports an account. The site never guesses between wallets.
// In both cases the wallet must already have authorized the site, so eager
// connect never opens a wallet prompt.
export const chooseEagerWallet = async (wallets, rememberedRdns) => {
  const candidates = rememberedRdns
    ? wallets.filter((wallet) => wallet.rdns === rememberedRdns)
    : wallets;

  if (rememberedRdns && candidates.length !== 1) {
    return null;
  }

  const authorized = await Promise.all(candidates.map(async (wallet) => (
    (await getConnectorForWallet(wallet).isAuthorized()) ? wallet : null
  )));
  const authorizedWallets = authorized.filter(Boolean);

  return authorizedWallets.length === 1 ? authorizedWallets[0] : null;
};

const useEagerConnect = () => {
  const { activate, active, setError } = useWeb3React();
  const {
    manualConnectRef, rememberedRdns, setAttemptedWallet, settled, wallets
  } = useWalletContext();
  const [tried, setTried] = useState(false);
  const decidedRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => () => {
    unmountedRef.current = true;
  }, []);

  useEffect(() => {
    if (decidedRef.current) {
      return;
    }

    if (isInjectedWalletAutoConnectSuppressed() || manualConnectRef.current.started) {
      decidedRef.current = true;
      setTried(true);
      return;
    }

    // D15: wait for announcements until discovery is settled, then decide once.
    if (!settled) {
      return;
    }

    decidedRef.current = true;
    const isCancelled = () => unmountedRef.current || manualConnectRef.current.started;

    chooseEagerWallet(wallets, rememberedRdns).then((wallet) => {
      if (isCancelled()) {
        if (!unmountedRef.current) {
          setTried(true);
        }
        return;
      }

      if (!wallet) {
        setTried(true);
        return;
      }

      setAttemptedWallet(wallet);
      activate(getConnectorForWallet(wallet), undefined, true).catch((activationError) => {
        if (unmountedRef.current) {
          return;
        }

        // A late eager result never replaces a manual connection.
        if (!manualConnectRef.current.started) {
          setError(activationError);
        }
        setTried(true);
      });
    });
  }, [activate, manualConnectRef, rememberedRdns, setAttemptedWallet, setError, settled, wallets]);

  // If the connection worked, wait for web3-react to confirm it.
  useEffect(() => {
    if (!tried && active) {
      setTried(true);
    }
  }, [tried, active]);

  return tried;
};

export default useEagerConnect;
