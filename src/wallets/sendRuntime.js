// The pieces that every send shares: the site RPC provider (plan D19), the
// submitted-operations store (G6), and the tracker. They live for the whole
// page and survive route changes.
import { useSyncExternalStore } from 'react';

import { providers } from 'ethers';

import { BRIDGE_DEPLOYMENT } from 'config/bridgeDeployment';
import { createTransactionTracker } from 'utils/transactionTracking';

import { createSubmittedOperations } from './submittedOperations';

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

// D19: G6 must read the expected chain, not the wallet's chain, and path S
// broadcasts through the same RPC. Without a valid URL, sends are disabled.
export const createSiteProvider = (deployment = BRIDGE_DEPLOYMENT) => {
  if (!isHttpUrl(deployment.ethereumRpcUrl)) {
    return null;
  }

  return new providers.StaticJsonRpcProvider(deployment.ethereumRpcUrl, {
    chainId: deployment.ethereumChainId,
    name: deployment.isTestnet ? 'sepolia' : 'homestead'
  });
};

const TRACKED_STATES = ['signed', 'submitted', 'observed'];

export const createSendRuntime = ({ siteProvider = createSiteProvider(), store = createSubmittedOperations() } = {}) => {
  const tracker = siteProvider ? createTransactionTracker({ siteProvider, store }) : null;

  // Every record that gets a hash starts tracking at once (G6 step 1).
  store.onTransition(({ recordId, to }) => {
    if (TRACKED_STATES.includes(to)) {
      tracker?.track(recordId);
    }
  });

  const ready = store.init().then(() => {
    tracker?.trackUnresolved();
  });

  return {
    ready, siteProvider, store, tracker
  };
};

let sharedRuntime = null;

export const getSendRuntime = () => {
  if (!sharedRuntime) {
    sharedRuntime = createSendRuntime();
  }

  return sharedRuntime;
};

export const setSendRuntimeForTests = (runtime) => {
  sharedRuntime = runtime;
};

export const useSubmittedOperations = () => {
  const { store } = getSendRuntime();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
};
