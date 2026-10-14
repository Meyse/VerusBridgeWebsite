import { isSupportedWalletRdns } from './supportedWallets';

// Discovery is "settled" this long after window load, or after start() when
// the page has already loaded (plan D3). Late wallets still appear afterwards,
// because the listener stays active (D1).
export const DISCOVERY_SETTLE_DELAY_MS = 500;

const ANNOUNCE_EVENT = 'eip6963:announceProvider';
const REQUEST_EVENT = 'eip6963:requestProvider';

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

// EIP-6963 security guidance: render icons only from data:image URIs (D11).
const toSafeIcon = (icon) => (isNonEmptyString(icon) && icon.startsWith('data:image/') ? icon : null);

// Reads an announcement inside try/catch, because a getter can throw. Returns
// null for an announcement that the bridge must ignore.
const readAnnouncement = (event) => {
  try {
    const { info, provider } = event.detail || {};
    const uuid = info?.uuid;
    const name = info?.name;
    const rdns = info?.rdns;

    if (!isNonEmptyString(uuid) || !isNonEmptyString(name) || !isNonEmptyString(rdns)) {
      return null;
    }

    if (!isSupportedWalletRdns(rdns) || typeof provider?.request !== 'function') {
      return null;
    }

    return { icon: toSafeIcon(info.icon), id: uuid, name, provider, rdns, uuid };
  } catch (error) {
    return null;
  }
};

// A store of the supported wallets that announce themselves with EIP-6963. It
// has no React in it, and it never reads win.ethereum (D9).
export const createWalletDiscovery = (win = window) => {
  let snapshot = { settled: false, wallets: [] };
  let started = false;
  let settleTimer = null;
  const listeners = new Set();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const setSnapshot = (nextSnapshot) => {
    snapshot = nextSnapshot;
    emit();
  };

  const handleAnnouncement = (event) => {
    const wallet = readAnnouncement(event);

    // D5: a repeat uuid is ignored, so a known entry never gets a new provider.
    // A new uuid with a listed rdns becomes its own entry.
    if (!wallet || snapshot.wallets.some((entry) => entry.uuid === wallet.uuid)) {
      return;
    }

    setSnapshot({ ...snapshot, wallets: [...snapshot.wallets, wallet] });
  };

  const requestProviders = () => {
    win.dispatchEvent(new Event(REQUEST_EVENT));
  };

  const scheduleSettle = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!snapshot.settled) {
        setSnapshot({ ...snapshot, settled: true });
      }
    }, DISCOVERY_SETTLE_DELAY_MS);
  };

  // Brave adds its requestProvider listener only at window load (2.3), so ask
  // again then.
  const handleLoad = () => {
    requestProviders();
    scheduleSettle();
  };

  const start = () => {
    if (started) {
      return;
    }

    started = true;
    win.addEventListener(ANNOUNCE_EVENT, handleAnnouncement);
    requestProviders();

    if (win.document?.readyState === 'complete') {
      scheduleSettle();
    } else {
      win.addEventListener('load', handleLoad, { once: true });
    }
  };

  const stop = () => {
    if (!started) {
      return;
    }

    started = false;
    clearTimeout(settleTimer);
    settleTimer = null;
    win.removeEventListener(ANNOUNCE_EVENT, handleAnnouncement);
    win.removeEventListener('load', handleLoad);
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getSnapshot: () => snapshot,
    start,
    stop,
    subscribe
  };
};
