import React from 'react';

import { render, screen } from '@testing-library/react';

import { useWeb3React } from '@web3-react/core';

import useInactiveListener from './useInactiveListener';

vi.mock('@web3-react/core', () => ({
  useWeb3React: vi.fn()
}));

// Mirrors Brave 1.94-1.97 with a Brave Wallet: the wallet locks `on`, and Brave's
// dapp metrics script wraps window.ethereum in a proxy whose get trap re-wraps
// every value, so reading `on` throws (brave/brave-browser#58890).
const createBraveWalletProvider = () => {
  const provider = { request: vi.fn() };
  Object.defineProperty(provider, 'on', { value: vi.fn(), writable: false, configurable: false });

  const wrap = (target) => (
    target !== null && (typeof target === 'object' || typeof target === 'function')
      ? new Proxy(target, { get: (...args) => wrap(Reflect.get(...args)) })
      : target
  );

  return wrap(provider);
};

const HookProbe = () => {
  useInactiveListener();

  return <div>page</div>;
};

describe('useInactiveListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWeb3React.mockReturnValue({
      active: false,
      error: undefined,
      activate: vi.fn()
    });
  });

  afterEach(() => {
    delete window.ethereum;
  });

  test('keeps the page rendered when the wallet provider throws on reading `on`', () => {
    window.ethereum = createBraveWalletProvider();

    render(<HookProbe />);

    expect(screen.getByText('page')).toBeInTheDocument();
  });

  test('subscribes to account changes and removes the listener on unmount', () => {
    const ethereum = { on: vi.fn(), removeListener: vi.fn() };
    window.ethereum = ethereum;

    const { unmount } = render(<HookProbe />);

    expect(ethereum.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    const accountsChangedHandler = ethereum.on.mock.calls.find(([event]) => event === 'accountsChanged')[1];

    unmount();

    expect(ethereum.removeListener).toHaveBeenCalledWith('accountsChanged', accountsChangedHandler);
  });
});
