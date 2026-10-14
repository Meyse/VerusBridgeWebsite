import { DISCOVERY_SETTLE_DELAY_MS, createWalletDiscovery } from './walletDiscovery';

const ICON = 'data:image/svg+xml;base64,PHN2Zy8+';

const createWindow = ({ readyState = 'complete' } = {}) => {
  const win = new EventTarget();
  win.document = { readyState };
  return win;
};

const createProvider = () => ({ request: vi.fn() });

// A wallet that follows EIP-6963: it announces once at once, and again on
// every requestProvider event, with the same uuid and provider.
const installWallet = (win, { icon = ICON, name, provider = createProvider(), rdns, uuid }) => {
  const announce = () => {
    win.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: { info: { icon, name, rdns, uuid }, provider }
    }));
  };

  win.addEventListener('eip6963:requestProvider', announce);
  announce();
  return { announce, provider };
};

const getWallets = (discovery) => discovery.getSnapshot().wallets;

describe('walletDiscovery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('lists a wallet that announced before start once, through requestProvider', () => {
    const win = createWindow();
    const metaMask = installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });
    const discovery = createWalletDiscovery(win);

    discovery.start();
    metaMask.announce();

    expect(getWallets(discovery)).toEqual([{
      icon: ICON,
      id: 'uuid-1',
      name: 'MetaMask',
      provider: metaMask.provider,
      rdns: 'io.metamask',
      uuid: 'uuid-1'
    }]);
  });

  test('lists a wallet that announces only at window load, the way Brave does', () => {
    vi.useFakeTimers();
    const win = createWindow({ readyState: 'loading' });
    const discovery = createWalletDiscovery(win);
    const provider = createProvider();

    discovery.start();
    expect(discovery.getSnapshot().settled).toBe(false);

    win.document.readyState = 'complete';
    win.addEventListener('eip6963:requestProvider', () => {
      win.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { info: { icon: ICON, name: 'Brave Wallet', rdns: 'com.brave.wallet', uuid: 'brave-1' }, provider }
      }));
    });
    win.dispatchEvent(new Event('load'));

    expect(getWallets(discovery).map((wallet) => wallet.name)).toEqual(['Brave Wallet']);
    expect(discovery.getSnapshot().settled).toBe(false);

    vi.advanceTimersByTime(DISCOVERY_SETTLE_DELAY_MS);
    expect(discovery.getSnapshot().settled).toBe(true);
  });

  test('settles 500 ms after start when the page has already loaded', () => {
    vi.useFakeTimers();
    const discovery = createWalletDiscovery(createWindow());

    discovery.start();
    vi.advanceTimersByTime(DISCOVERY_SETTLE_DELAY_MS - 1);
    expect(discovery.getSnapshot().settled).toBe(false);

    vi.advanceTimersByTime(1);
    expect(discovery.getSnapshot().settled).toBe(true);
    expect(DISCOVERY_SETTLE_DELAY_MS).toBe(500);
  });

  test('ignores a repeat announcement with the same uuid and never replaces its provider', () => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();
    const first = installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });

    win.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: { info: { icon: ICON, name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' }, provider: createProvider() }
    }));

    expect(getWallets(discovery)).toHaveLength(1);
    expect(getWallets(discovery)[0].provider).toBe(first.provider);
  });

  test('adds a second entry for a new provider that claims a listed rdns', () => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();
    const first = installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });
    const second = installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-2' });

    expect(getWallets(discovery).map((wallet) => wallet.provider)).toEqual([first.provider, second.provider]);
  });

  test.each([
    ['a provider without request', { info: { icon: ICON, name: 'MetaMask', rdns: 'io.metamask', uuid: 'a' }, provider: {} }],
    ['an empty rdns', { info: { icon: ICON, name: 'MetaMask', rdns: '', uuid: 'b' }, provider: createProvider() }],
    ['an empty name', { info: { icon: ICON, name: '', rdns: 'io.metamask', uuid: 'c' }, provider: createProvider() }],
    ['an empty uuid', { info: { icon: ICON, name: 'MetaMask', rdns: 'io.metamask', uuid: '' }, provider: createProvider() }],
    ['a throwing getter', {
      get info() {
        throw new TypeError('blocked');
      },
      provider: createProvider()
    }]
  ])('ignores %s', (_label, detail) => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();

    win.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));

    expect(getWallets(discovery)).toEqual([]);
  });

  test('drops an icon that is not a data:image URI', () => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();
    installWallet(win, { icon: 'https://example.com/icon.png', name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });

    expect(getWallets(discovery)[0].icon).toBeNull();
  });

  test.each(['com.coinbase.wallet', 'io.rabby', 'io.metamask.flask'])('ignores the unsupported wallet %s', (rdns) => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();
    installWallet(win, { name: 'Other', rdns, uuid: rdns });

    expect(getWallets(discovery)).toEqual([]);
  });

  test('never reads window.ethereum, which Brave can make throw', () => {
    const win = createWindow();
    let reads = 0;
    Object.defineProperty(win, 'ethereum', {
      get() {
        reads += 1;
        throw new TypeError('Brave proxy');
      }
    });
    const discovery = createWalletDiscovery(win);

    discovery.start();

    expect(getWallets(discovery)).toEqual([]);
    expect(reads).toBe(0);
  });

  test('a second start adds no second listener, and stop removes it', () => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    const listener = vi.fn();
    discovery.subscribe(listener);

    discovery.start();
    discovery.start();
    installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });
    expect(listener).toHaveBeenCalledTimes(1);

    discovery.stop();
    discovery.stop();
    installWallet(win, { name: 'Brave Wallet', rdns: 'com.brave.wallet', uuid: 'brave-1' });
    expect(getWallets(discovery)).toHaveLength(1);
  });

  test('returns the same snapshot object until something changes', () => {
    const win = createWindow();
    const discovery = createWalletDiscovery(win);
    discovery.start();
    const before = discovery.getSnapshot();

    expect(discovery.getSnapshot()).toBe(before);

    installWallet(win, { name: 'MetaMask', rdns: 'io.metamask', uuid: 'uuid-1' });
    expect(discovery.getSnapshot()).not.toBe(before);
  });
});
