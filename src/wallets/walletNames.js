// The wallet name in messages is the name that the wallet announces (plan D12).
// Without one, messages say "your wallet". Use walletNameAtStart() at the start
// of a sentence.
export const FALLBACK_WALLET_NAME = 'your wallet';

export const walletName = (wallet) => (
  typeof wallet?.name === 'string' && wallet.name.trim() ? wallet.name.trim() : FALLBACK_WALLET_NAME
);

export const walletNameAtStart = (wallet) => {
  const name = walletName(wallet);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};
