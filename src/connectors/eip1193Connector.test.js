import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';

import {
  Eip1193Connector,
  UserRejectedRequestError,
  WalletEventsUnavailableError,
  getConnectorForWallet
} from './eip1193Connector';

const ACCOUNT = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';

// A fake EIP-1193 provider that keeps its listeners, so a test can emit events.
const createProvider = ({ accounts = [ACCOUNT], chainId = '0xaa36a7', onThrows = false, removeThrows = false } = {}) => {
  const listeners = new Map();
  return {
    emit: (event, payload) => (listeners.get(event) || []).forEach((handler) => handler(payload)),
    listenerCount: (event) => (listeners.get(event) || []).length,
    on: vi.fn((event, handler) => {
      if (onThrows && event === 'chainChanged') {
        throw new TypeError('on is blocked');
      }
      listeners.set(event, [...(listeners.get(event) || []), handler]);
    }),
    removeListener: vi.fn((event, handler) => {
      if (removeThrows) {
        throw new TypeError('removeListener is blocked');
      }
      listeners.set(event, (listeners.get(event) || []).filter((entry) => entry !== handler));
    }),
    request: vi.fn(async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return typeof accounts === 'function' ? accounts() : accounts;
      }
      if (method === 'eth_chainId') {
        return chainId;
      }
      throw new Error(`Unexpected method ${method}`);
    })
  };
};

const createConnector = (provider, name = 'Brave Wallet') => new Eip1193Connector({
  provider,
  wallet: { id: 'uuid-1', name, provider, rdns: 'com.brave.wallet' }
});

describe('Eip1193Connector', () => {
  test('supports only the expected chain', () => {
    expect(createConnector(createProvider()).supportedChainIds).toEqual([EXPECTED_ETHEREUM_CHAIN_ID]);
  });

  test('activate returns the provider and the first account', async () => {
    const provider = createProvider({ accounts: [ACCOUNT, '0x0000000000000000000000000000000000000001'] });

    await expect(createConnector(provider).activate()).resolves.toEqual({ account: ACCOUNT, provider });
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  test.each([
    ['an empty account list', []],
    ['a malformed account list', ['not-an-address']],
    ['no list at all', null]
  ])('activate fails for %s', async (_label, accounts) => {
    await expect(createConnector(createProvider({ accounts })).activate()).rejects.toThrow();
  });

  test('maps a rejection with code 4001 to UserRejectedRequestError', async () => {
    const provider = createProvider();
    provider.request.mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }));

    await expect(createConnector(provider).activate()).rejects.toBeInstanceOf(UserRejectedRequestError);
  });

  test('fails with the D4 message and leaves no partial listeners when a subscription throws', async () => {
    const provider = createProvider({ onThrows: true });

    await expect(createConnector(provider).activate()).rejects.toThrow(
      'Brave Wallet does not report account or network changes, so the bridge cannot use it.'
    );
    await expect(createConnector(provider).activate()).rejects.toBeInstanceOf(WalletEventsUnavailableError);
    expect(provider.listenerCount('accountsChanged')).toBe(0);
    expect(provider.listenerCount('disconnect')).toBe(0);
  });

  test('uses "Your wallet" in the D4 message when the wallet has no name', async () => {
    await expect(createConnector(createProvider({ onThrows: true }), '').activate()).rejects.toThrow(
      'Your wallet does not report account or network changes, so the bridge cannot use it.'
    );
  });

  test('a second activate adds no second set of listeners', async () => {
    const provider = createProvider();
    const connector = createConnector(provider);

    await connector.activate();
    await connector.activate();

    expect(provider.listenerCount('accountsChanged')).toBe(1);
    expect(provider.listenerCount('chainChanged')).toBe(1);
    expect(provider.listenerCount('disconnect')).toBe(1);
  });

  test('emits deactivate for an empty account list and an update for a new account or chain', async () => {
    const provider = createProvider();
    const connector = createConnector(provider);
    const onUpdate = vi.fn();
    const onDeactivate = vi.fn();
    connector.on('Web3ReactUpdate', onUpdate);
    connector.on('Web3ReactDeactivate', onDeactivate);
    await connector.activate();

    provider.emit('chainChanged', '0x1');
    provider.emit('accountsChanged', ['0x0000000000000000000000000000000000000002']);
    provider.emit('accountsChanged', []);
    provider.emit('disconnect', { code: 4900 });

    expect(onUpdate).toHaveBeenCalledWith({ chainId: '0x1', provider });
    expect(onUpdate).toHaveBeenCalledWith({ account: '0x0000000000000000000000000000000000000002' });
    expect(onDeactivate).toHaveBeenCalledTimes(2);
  });

  test('deactivate survives a removeListener that throws', async () => {
    const provider = createProvider({ removeThrows: true });
    const connector = createConnector(provider);
    await connector.activate();

    expect(() => connector.deactivate()).not.toThrow();
  });

  test('getChainId reads eth_chainId and rejects an invalid value', async () => {
    await expect(createConnector(createProvider()).getChainId()).resolves.toBe(11155111);
    await expect(createConnector(createProvider({ chainId: 'nonsense' })).getChainId()).rejects.toThrow();
  });

  test('getAccount returns the first account or null', async () => {
    await expect(createConnector(createProvider()).getAccount()).resolves.toBe(ACCOUNT);
    await expect(createConnector(createProvider({ accounts: [] })).getAccount()).resolves.toBeNull();
  });

  test('isAuthorized is true for a non-empty account list and false on any error', async () => {
    const failing = createProvider();
    failing.request.mockRejectedValue(new Error('locked'));

    await expect(createConnector(createProvider()).isAuthorized()).resolves.toBe(true);
    await expect(createConnector(createProvider({ accounts: [] })).isAuthorized()).resolves.toBe(false);
    await expect(createConnector(failing).isAuthorized()).resolves.toBe(false);
  });

  test('getConnectorForWallet keeps one connector per wallet entry', () => {
    const provider = createProvider();
    const wallet = { id: 'uuid-cache', name: 'MetaMask', provider, rdns: 'io.metamask' };

    expect(getConnectorForWallet(wallet)).toBe(getConnectorForWallet(wallet));
    expect(getConnectorForWallet({ ...wallet, id: 'uuid-other' })).not.toBe(getConnectorForWallet(wallet));
    expect(getConnectorForWallet(wallet).wallet).toBe(wallet);
  });
});
