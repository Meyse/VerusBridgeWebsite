import { EventEmitter } from 'events';

import {
  getWalletSession,
  invalidateWalletSession,
  resetWalletSessionForTests,
  subscribeWalletSession,
  syncWalletSession
} from './walletSession';

const ACCOUNT = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
const OTHER_ACCOUNT = '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF';

// web3-react connectors are event emitters. The pinned provider's events reach
// the session through the connector (plan A2, B2).
const createConnector = () => new EventEmitter();

describe('walletSession', () => {
  beforeEach(() => {
    resetWalletSessionForTests();
  });

  test('pins the connector, provider, account, and chain, and gives the session an id', () => {
    const connector = createConnector();
    const provider = {};

    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector, provider, wallet: { name: 'MetaMask' } });
    const session = getWalletSession();

    expect(session).toMatchObject({ account: ACCOUNT, chainId: 11155111, connector, provider });
    expect(session.wallet.name).toBe('MetaMask');
    expect(session.id).toBeGreaterThan(0);
  });

  test('keeps the id when nothing changed', () => {
    const connector = createConnector();
    const provider = {};
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector, provider });
    const { id } = getWalletSession();

    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector, provider });

    expect(getWalletSession().id).toBe(id);
  });

  test.each([
    ['another account', { account: OTHER_ACCOUNT }],
    ['another chain', { chainId: 1 }],
    ['another connector', { connector: createConnector() }],
    ['another provider with the same account', { provider: {} }]
  ])('starts a new session for %s', (_label, change) => {
    const base = { account: ACCOUNT, chainId: 11155111, connector: createConnector(), provider: {} };
    syncWalletSession(base);
    const { id } = getWalletSession();

    syncWalletSession({ ...base, ...change });

    expect(getWalletSession().id).toBeGreaterThan(id);
  });

  test('a wallet event invalidates the session synchronously, also when the account changes back', () => {
    const connector = createConnector();
    const base = { account: ACCOUNT, chainId: 11155111, connector, provider: {} };
    syncWalletSession(base);
    const { id } = getWalletSession();

    connector.emit('Web3ReactUpdate', { account: OTHER_ACCOUNT });
    const afterFirstEvent = getWalletSession().id;
    connector.emit('Web3ReactUpdate', { account: ACCOUNT });

    expect(afterFirstEvent).toBeGreaterThan(id);
    expect(getWalletSession().id).toBeGreaterThan(afterFirstEvent);
  });

  test('a disconnect event invalidates the session', () => {
    const connector = createConnector();
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector, provider: {} });
    const { id } = getWalletSession();

    connector.emit('Web3ReactDeactivate');

    expect(getWalletSession().id).toBeGreaterThan(id);
  });

  test('stops listening to the old connector after a change', () => {
    const oldConnector = createConnector();
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector: oldConnector, provider: {} });
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector: createConnector(), provider: {} });
    const { id } = getWalletSession();

    oldConnector.emit('Web3ReactUpdate', { account: OTHER_ACCOUNT });

    expect(getWalletSession().id).toBe(id);
    expect(oldConnector.listenerCount('Web3ReactUpdate')).toBe(0);
  });

  test('a manual connect or disconnect invalidates the session', () => {
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector: createConnector(), provider: {} });
    const { id } = getWalletSession();

    invalidateWalletSession();

    expect(getWalletSession().id).toBe(id + 1);
  });

  test('clearing the wallet ends the pinned session', () => {
    syncWalletSession({ account: ACCOUNT, chainId: 11155111, connector: createConnector(), provider: {} });
    const { id } = getWalletSession();

    syncWalletSession({ account: null, chainId: null, connector: null, provider: null });

    expect(getWalletSession()).toMatchObject({ account: null, connector: null, provider: null });
    expect(getWalletSession().id).toBeGreaterThan(id);
  });

  test('notifies subscribers when the id changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWalletSession(listener);

    invalidateWalletSession();
    unsubscribe();
    invalidateWalletSession();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
