// The wallet session (plan G3). It lives outside React, so a check between two
// awaits sees a change at once, not after the next render.
//
// The id goes up when:
// - the pinned connector reports an account change, a network change, or a
//   disconnect. This happens synchronously in the wallet's event handler, so an
//   account that changes and changes back during one wait still counts;
// - web3-react reports another connector, account, chain, or provider;
// - a manual connect or disconnect starts.
//
// A review and every send capture the id and check it again before they act.

const CONNECTOR_EVENTS = ['Web3ReactUpdate', 'Web3ReactDeactivate'];

const createEmptySession = (id) => ({
  account: null,
  chainId: null,
  connector: null,
  id,
  provider: null,
  wallet: null
});

let session = createEmptySession(0);
let detachConnector = () => {};
const listeners = new Set();

const emit = () => {
  listeners.forEach((listener) => listener(session));
};

export const invalidateWalletSession = () => {
  session = { ...session, id: session.id + 1 };
  emit();
};

const attachConnector = (connector) => {
  detachConnector();

  if (!connector || typeof connector.on !== 'function') {
    detachConnector = () => {};
    return;
  }

  CONNECTOR_EVENTS.forEach((event) => connector.on(event, invalidateWalletSession));
  detachConnector = () => {
    CONNECTOR_EVENTS.forEach((event) => connector.removeListener(event, invalidateWalletSession));
  };
};

const sameAccount = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();

// Pins what web3-react reports. Anything new starts a new session.
export const syncWalletSession = ({ account = null, chainId = null, connector = null, provider = null, wallet = null }) => {
  const changed = connector !== session.connector
    || provider !== session.provider
    || !sameAccount(account, session.account)
    || chainId !== session.chainId;

  if (connector !== session.connector) {
    attachConnector(connector);
  }

  if (!changed) {
    if (wallet !== session.wallet) {
      session = { ...session, wallet };
    }
    return;
  }

  session = {
    account: account || null,
    chainId: chainId ?? null,
    connector: connector || null,
    id: session.id + 1,
    provider: provider || null,
    wallet: wallet || null
  };
  emit();
};

export const getWalletSession = () => session;

export const getWalletSessionId = () => session.id;

export const subscribeWalletSession = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetWalletSessionForTests = () => {
  detachConnector();
  detachConnector = () => {};
  session = createEmptySession(0);
  listeners.clear();
};
