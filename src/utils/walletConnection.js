export const INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY = 'verus-bridge.injected-wallet-auto-connect-disabled';

const hasLocalStorage = () => typeof window !== 'undefined' && window.localStorage;

export const isInjectedWalletAutoConnectSuppressed = () => {
  if (!hasLocalStorage()) {
    return false;
  }

  try {
    return window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY) === 'true';
  } catch (error) {
    return false;
  }
};

export const suppressInjectedWalletAutoConnect = () => {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
  } catch (error) {
    // Ignore storage failures and fall back to connector authorization state.
  }
};

export const clearInjectedWalletAutoConnectSuppression = () => {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY);
  } catch (error) {
    // Ignore storage failures and fall back to connector authorization state.
  }
};
