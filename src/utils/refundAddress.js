import { address as baddress, crypto as bcrypto } from '@bitgo/utxo-lib';
import { utils } from 'ethers';

const REFUND_ADDRESS_MESSAGE = 'Agreeing to this will create a public key address for Verus Refunds.';

export const REFUND_ADDRESS_STORAGE_KEY = 'pubkeyAddress';
export const REFUND_ADDRESS_SIGNATURE_STATUS_KEY = 'pubkeyAddressSignatureStatus';
export const REFUND_ADDRESS_STATE_EVENT = 'verus-bridge.refund-address-state-change';
export const REFUND_ADDRESS_STATUS_FAILED = 'failed';
export const REFUND_ADDRESS_STATUS_REQUIRED = 'required';

const refundAddressRequestByAccount = new Map();

const hasLocalStorage = () => typeof window !== 'undefined' && window.localStorage;

const getHexEncodedRefundMessage = () => `0x${Buffer.from(REFUND_ADDRESS_MESSAGE, 'utf8').toString('hex')}`;

const getAccountStorageKey = (account) => account || '';
const getNormalizedAccountStorageKey = (account) => getAccountStorageKey(account).toLowerCase();

const readStoredJson = (storageKey) => {
  if (!hasLocalStorage()) {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || '{}');
  } catch (error) {
    return {};
  }
};

const writeStoredJson = (storageKey, value) => {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

const dispatchRefundAddressStateChange = (account) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(REFUND_ADDRESS_STATE_EVENT, {
    detail: { account }
  }));
};

export const getStoredRefundAddresses = () => readStoredJson(REFUND_ADDRESS_STORAGE_KEY);

export const getCachedRefundAddress = (account, storedAddresses = getStoredRefundAddresses()) => {
  if (!account) {
    return '';
  }

  const accountStorageKey = getAccountStorageKey(account);
  if (storedAddresses[accountStorageKey]) {
    return storedAddresses[accountStorageKey];
  }

  const normalizedAccount = account.toLowerCase();
  const matchingEntry = Object.entries(storedAddresses)
    .find(([storedAccount]) => storedAccount.toLowerCase() === normalizedAccount);

  return matchingEntry?.[1] || '';
};

export const setCachedRefundAddress = (account, refundAddress) => {
  const storedAddresses = getStoredRefundAddresses();
  const nextStoredAddresses = {
    ...storedAddresses,
    [getAccountStorageKey(account)]: refundAddress
  };

  writeStoredJson(REFUND_ADDRESS_STORAGE_KEY, nextStoredAddresses);
  dispatchRefundAddressStateChange(account);
  return nextStoredAddresses;
};

const getRefundAddressSignatureStatuses = () => readStoredJson(REFUND_ADDRESS_SIGNATURE_STATUS_KEY);

export const getRefundAddressSignatureStatus = (account) => {
  const statuses = getRefundAddressSignatureStatuses();
  const accountStorageKey = getAccountStorageKey(account);

  if (statuses[accountStorageKey]) {
    return statuses[accountStorageKey];
  }

  const normalizedAccount = getNormalizedAccountStorageKey(account);
  const matchingEntry = Object.entries(statuses)
    .find(([storedAccount]) => storedAccount.toLowerCase() === normalizedAccount);

  return matchingEntry?.[1] || '';
};

export const setRefundAddressSignatureStatus = (account, status) => {
  const statuses = getRefundAddressSignatureStatuses();
  const accountStorageKey = getAccountStorageKey(account);
  const nextStatuses = {
    ...statuses,
    [accountStorageKey]: status
  };

  writeStoredJson(REFUND_ADDRESS_SIGNATURE_STATUS_KEY, nextStatuses);
  dispatchRefundAddressStateChange(account);
};

export const clearRefundAddressSignatureStatus = (account) => {
  const statuses = getRefundAddressSignatureStatuses();
  const accountStorageKey = getAccountStorageKey(account);

  if (!statuses[accountStorageKey]) {
    return;
  }

  const nextStatuses = { ...statuses };
  delete nextStatuses[accountStorageKey];

  writeStoredJson(REFUND_ADDRESS_SIGNATURE_STATUS_KEY, nextStatuses);
  dispatchRefundAddressStateChange(account);
};

export const requestRefundAddressData = async (account) => {
  if (!account) {
    throw new Error('Wallet account not found.');
  }

  if (!window.ethereum) {
    throw new Error('Ethereum provider not found.');
  }

  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [getHexEncodedRefundMessage(), account]
  });

  const messageHash = utils.hashMessage(REFUND_ADDRESS_MESSAGE);
  const publicKey = utils.recoverPublicKey(utils.arrayify(messageHash), signature);
  const compressedPublicKey = utils.computePublicKey(publicKey, true);
  const refundAddress = baddress.toBase58Check(
    bcrypto.hash160(Buffer.from(compressedPublicKey.slice(2), 'hex')),
    60
  );

  return {
    publicKey,
    refundAddress
  };
};

export const requestAndCacheRefundAddressData = async (account) => {
  const cachedRefundAddress = getCachedRefundAddress(account);
  if (cachedRefundAddress) {
    clearRefundAddressSignatureStatus(account);
    return {
      publicKey: '',
      refundAddress: cachedRefundAddress
    };
  }

  const requestKey = getNormalizedAccountStorageKey(account);
  const inFlightRequest = refundAddressRequestByAccount.get(requestKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const requestPromise = requestRefundAddressData(account)
    .then((refundAddressData) => {
      setCachedRefundAddress(account, refundAddressData.refundAddress);
      clearRefundAddressSignatureStatus(account);

      return refundAddressData;
    })
    .finally(() => {
      refundAddressRequestByAccount.delete(requestKey);
    });

  refundAddressRequestByAccount.set(requestKey, requestPromise);
  return requestPromise;
};
