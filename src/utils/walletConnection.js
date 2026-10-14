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

// The rdns of the wallet the user chose last (plan D6). It is only a reconnect
// preference: eager connect uses it when exactly one wallet entry has it.
export const REMEMBERED_WALLET_RDNS_KEY = 'verus-bridge.wallet-rdns';

export const getRememberedWalletRdns = () => {
  if (!hasLocalStorage()) {
    return '';
  }

  try {
    return window.localStorage.getItem(REMEMBERED_WALLET_RDNS_KEY) || '';
  } catch (error) {
    return '';
  }
};

export const setRememberedWalletRdns = (rdns) => {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(REMEMBERED_WALLET_RDNS_KEY, rdns);
  } catch (error) {
    // Ignore storage failures. The user picks from the menu next time.
  }
};
