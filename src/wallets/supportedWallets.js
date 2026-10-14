// The only wallets the bridge lists and sends with (plan D2, D18). MetaMask
// enforces the request's chainId (send path E). Brave Wallet signs only, and the
// site checks and broadcasts the transaction (send path S).
export const METAMASK_RDNS = 'io.metamask';
export const BRAVE_WALLET_RDNS = 'com.brave.wallet';

export const SUPPORTED_WALLET_RDNS = Object.freeze([METAMASK_RDNS, BRAVE_WALLET_RDNS]);

export const isSupportedWalletRdns = (rdns) => SUPPORTED_WALLET_RDNS.includes(rdns);
