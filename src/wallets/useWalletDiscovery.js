import { useSyncExternalStore } from 'react';

import { createWalletDiscovery } from './walletDiscovery';

let sharedDiscovery = null;

// One discovery store for the whole page. It starts on first use and keeps its
// announcement listener for the life of the page (plan D1).
export const getWalletDiscovery = () => {
  if (!sharedDiscovery) {
    sharedDiscovery = createWalletDiscovery(window);
    sharedDiscovery.start();
  }

  return sharedDiscovery;
};

export const resetWalletDiscoveryForTests = () => {
  sharedDiscovery?.stop();
  sharedDiscovery = null;
};

const useWalletDiscovery = () => {
  const discovery = getWalletDiscovery();
  return useSyncExternalStore(discovery.subscribe, discovery.getSnapshot, discovery.getSnapshot);
};

export default useWalletDiscovery;
