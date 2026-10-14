// Shared wallet fixtures for tests (plan 8.5).

// Mirrors Brave 1.94-1.97 with a Brave Wallet: the wallet locks `on`, and
// Brave's dapp metrics script wraps window.ethereum in a proxy whose get trap
// re-wraps every value, so reading `on` throws (brave/brave-browser#58890).
export const createBraveWalletProxyProvider = () => {
  const provider = { request: vi.fn() };
  Object.defineProperty(provider, 'on', { configurable: false, value: vi.fn(), writable: false });

  const wrap = (target) => (
    target !== null && (typeof target === 'object' || typeof target === 'function')
      ? new Proxy(target, { get: (...args) => wrap(Reflect.get(...args)) })
      : target
  );

  return wrap(provider);
};

// A plain EIP-1193 provider that keeps its listeners, like the unwrapped
// provider that Brave announces with EIP-6963.
export const createEip1193Provider = ({ accounts = [], chainId = '0x1', request } = {}) => {
  const listeners = new Map();
  const provider = {
    emit: (event, payload) => (listeners.get(event) || []).forEach((handler) => handler(payload)),
    listenerCount: (event) => (listeners.get(event) || []).length,
    on: vi.fn((event, handler) => {
      listeners.set(event, [...(listeners.get(event) || []), handler]);
    }),
    removeListener: vi.fn((event, handler) => {
      listeners.set(event, (listeners.get(event) || []).filter((entry) => entry !== handler));
    }),
    request: vi.fn(async ({ method, params }) => {
      if (request) {
        const answer = await request({ method, params });
        if (answer !== undefined) {
          return answer;
        }
      }
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return accounts;
      }
      if (method === 'eth_chainId') {
        return chainId;
      }
      return null;
    })
  };
  return provider;
};

export const WALLET_ICON = 'data:image/svg+xml;base64,PHN2Zy8+';

// Installs a wallet that answers EIP-6963 requestProvider events and announces
// once at once. Returns the announcement detail and a cleanup function.
export const announceWallet = ({
  icon = WALLET_ICON, name, provider = createEip1193Provider(), rdns, uuid
}, win = window) => {
  const detail = { info: { icon, name, rdns, uuid }, provider };
  const announce = () => {
    win.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  };

  win.addEventListener('eip6963:requestProvider', announce);
  announce();

  return {
    ...detail,
    remove: () => win.removeEventListener('eip6963:requestProvider', announce)
  };
};
