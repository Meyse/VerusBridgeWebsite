import { utils } from 'ethers';

import { hash160, toBase58Check } from './verusAddress';

const REFUND_ADDRESS_MESSAGE = 'Agreeing to this will create a public key address for Verus Refunds.';
const REFUND_ADDRESS_VERSION_BYTE = 60;
const REFUND_RECORD_VERSION = 2;

export const REFUND_KEY_MISMATCH_MESSAGE = "Your wallet did not sign with this account's key. The bridge cannot create a refund address for this account.";

// Old address-only cache. Nothing reads it for use: an entry in it was never
// checked against the account. The key stays in storage and is never deleted.
export const REFUND_ADDRESS_STORAGE_KEY = 'pubkeyAddress';
// Verified records: { account, publicKey, refundAddress, version: 2 }.
export const REFUND_ADDRESS_V2_STORAGE_KEY = 'pubkeyAddressV2';
export const REFUND_ADDRESS_SIGNATURE_STATUS_KEY = 'pubkeyAddressSignatureStatus';
export const REFUND_ADDRESS_STATE_EVENT = 'verus-bridge.refund-address-state-change';
export const REFUND_ADDRESS_STATUS_FAILED = 'failed';
export const REFUND_ADDRESS_STATUS_REQUIRED = 'required';

export class RefundKeyMismatchError extends Error {
  constructor() {
    super(REFUND_KEY_MISMATCH_MESSAGE);
    this.name = 'RefundKeyMismatchError';
  }
}

// In-flight signature requests, keyed by the wallet provider object and then by
// the account. A request for another wallet or another account never shares one.
const refundRequestsByProvider = new WeakMap();

const hasLocalStorage = () => typeof window !== 'undefined' && window.localStorage;

const getHexEncodedRefundMessage = () => `0x${Buffer.from(REFUND_ADDRESS_MESSAGE, 'utf8').toString('hex')}`;

const getAccountStorageKey = (account) => account || '';
const getNormalizedAccountStorageKey = (account) => getAccountStorageKey(account).toLowerCase();

const readStoredJson = (storageKey) => {
  if (!hasLocalStorage()) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? parsedValue : {};
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

const deriveRefundAddress = (publicKey) => {
  const compressedPublicKey = utils.computePublicKey(publicKey, true);

  return toBase58Check(
    hash160(Buffer.from(compressedPublicKey.slice(2), 'hex')),
    REFUND_ADDRESS_VERSION_BYTE
  );
};

const publicKeyBelongsToAccount = (publicKey, account) => {
  try {
    return utils.computeAddress(publicKey).toLowerCase() === String(account || '').toLowerCase();
  } catch (error) {
    return false;
  }
};

// A record counts only when all of these hold: version 2, stored for this
// account, the public key maps to the account, and the refund address is the
// one that the public key derives.
const isValidRefundRecord = (record, account) => {
  if (!record || typeof record !== 'object' || record.version !== REFUND_RECORD_VERSION) {
    return false;
  }

  if (typeof record.account !== 'string' || record.account.toLowerCase() !== String(account || '').toLowerCase()) {
    return false;
  }

  if (typeof record.publicKey !== 'string' || typeof record.refundAddress !== 'string') {
    return false;
  }

  if (!publicKeyBelongsToAccount(record.publicKey, account)) {
    return false;
  }

  try {
    return deriveRefundAddress(record.publicKey) === record.refundAddress;
  } catch (error) {
    return false;
  }
};

const getValidRefundRecords = () => Object.values(readStoredJson(REFUND_ADDRESS_V2_STORAGE_KEY))
  .filter((record) => record && isValidRefundRecord(record, record.account));

const getValidRefundRecord = (account) => {
  if (!account) {
    return null;
  }

  const normalizedAccount = getNormalizedAccountStorageKey(account);
  return getValidRefundRecords()
    .find((record) => record.account.toLowerCase() === normalizedAccount) || null;
};

// Returns { [account]: refundAddress } for verified records only.
export const getStoredRefundAddresses = () => Object.fromEntries(
  getValidRefundRecords().map((record) => [record.account, record.refundAddress])
);

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

const setCachedRefundRecord = (account, { publicKey, refundAddress }) => {
  const records = readStoredJson(REFUND_ADDRESS_V2_STORAGE_KEY);

  writeStoredJson(REFUND_ADDRESS_V2_STORAGE_KEY, {
    ...records,
    [getNormalizedAccountStorageKey(account)]: {
      account,
      publicKey,
      refundAddress,
      version: REFUND_RECORD_VERSION
    }
  });
  dispatchRefundAddressStateChange(account);
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

// Signs the refund message through the wallet that `library` wraps and checks
// that the key belongs to `account` (G1). This is a capability check, not a
// wallet-brand check: a smart-account wallet can return a signature that
// recovers to another key, and the site must not embed that key's address.
export const requestRefundAddressData = async (account, library) => {
  if (!account) {
    throw new Error('Wallet account not found.');
  }

  if (!library || typeof library.send !== 'function') {
    throw new Error('Wallet is not connected.');
  }

  const signature = await library.send('personal_sign', [getHexEncodedRefundMessage(), account]);

  // The wallet can change account while it waits for the user.
  const currentAccounts = await library.send('eth_accounts', []);
  if (!Array.isArray(currentAccounts) || String(currentAccounts[0] || '').toLowerCase() !== account.toLowerCase()) {
    throw new Error('Your wallet account changed while it was signing. Try again.');
  }

  const messageHash = utils.hashMessage(REFUND_ADDRESS_MESSAGE);
  const publicKey = utils.recoverPublicKey(utils.arrayify(messageHash), signature);

  if (!publicKeyBelongsToAccount(publicKey, account)) {
    throw new RefundKeyMismatchError();
  }

  return {
    publicKey,
    refundAddress: deriveRefundAddress(publicKey)
  };
};

export const requestAndCacheRefundAddressData = async (account, library) => {
  const cachedRecord = getValidRefundRecord(account);
  if (cachedRecord) {
    clearRefundAddressSignatureStatus(account);
    return {
      publicKey: cachedRecord.publicKey,
      refundAddress: cachedRecord.refundAddress
    };
  }

  const providerKey = library?.provider || library;
  const requestKey = getNormalizedAccountStorageKey(account);
  const requestsByAccount = providerKey && typeof providerKey === 'object'
    ? (refundRequestsByProvider.get(providerKey) || new Map())
    : new Map();
  const inFlightRequest = requestsByAccount.get(requestKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const requestPromise = requestRefundAddressData(account, library)
    .then((refundAddressData) => {
      setCachedRefundRecord(account, refundAddressData);
      clearRefundAddressSignatureStatus(account);

      return refundAddressData;
    })
    .finally(() => {
      requestsByAccount.delete(requestKey);
    });

  requestsByAccount.set(requestKey, requestPromise);
  if (providerKey && typeof providerKey === 'object') {
    refundRequestsByProvider.set(providerKey, requestsByAccount);
  }

  return requestPromise;
};
