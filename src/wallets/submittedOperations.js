// Submitted operations (plan G6). One record for each request that the site
// sends to a wallet. Records survive a reload, block new sends from the same
// account while they are not resolved, and drive the send screens (3.2).
//
// Storage rules:
// - Every change is one read-modify-write inside a short exclusive Web Lock
//   (the storage lock). Inside it, read fresh data, change one record, write.
//   Never hold the storage lock while waiting for a wallet or an RPC.
// - States only move forward. A transition names the states that it expects;
//   if the stored record is in another state, the transition is ignored. A
//   resolved record never changes.
// - Without navigator.locks, the store changes no records. It shows restored
//   records read-only.

export const SUBMITTED_OPERATIONS_STORAGE_KEY = 'verus-bridge.submitted-operations';
export const STORAGE_LOCK_NAME = 'verus-bridge.submitted-operations';
export const RESOLVED_RECORD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const STORAGE_UNAVAILABLE_MESSAGE = 'This browser does not let the site save data, so the bridge cannot protect you from sending twice. Allow site data for this site, then try again.';
export const SEND_BLOCKED_MESSAGE = 'A transfer from this account is not confirmed yet. Wait for it, or check it again.';

export const RECORD_STATES = Object.freeze(['awaiting-wallet', 'signed', 'submitted', 'observed', 'resolved']);
export const RECORD_TYPES = Object.freeze(['erc20-approval', 'erc721-approval', 'erc1155-approval', 'transfer', 'claim', 'nft']);
export const OUTCOMES = Object.freeze([
  'success',
  'reverted',
  'cancelled',
  'replaced',
  'confirmed-unexpected',
  'rejected',
  'discarded',
  'user-cleared'
]);

export class StorageUnavailableError extends Error {
  constructor() {
    super(STORAGE_UNAVAILABLE_MESSAGE);
    this.name = 'StorageUnavailableError';
  }
}

export class SendBlockedError extends Error {
  constructor(record) {
    super(SEND_BLOCKED_MESSAGE);
    this.name = 'SendBlockedError';
    this.record = record;
  }
}

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HEX_PATTERN = /^0x[0-9a-fA-F]*$/;
const MAX_RAW_TRANSACTION_LENGTH = 200000;
const MAX_DATA_LENGTH = 200000;

const isString = (value, maxLength) => typeof value === 'string' && value.length <= maxLength;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const DISPLAY_FIELD_LIMITS = {
  approvalCap: 48,
  destination: 100,
  destinationName: 100,
  receive: 48,
  send: 48,
  spender: 42,
  timeEstimate: 24,
  walletName: 64
};

// Keeps only display fields with the right type and length (3.2, "Stored fields").
const sanitizeDisplay = (display) => {
  if (!display || typeof display !== 'object') {
    return {};
  }

  const clean = {};
  Object.entries(DISPLAY_FIELD_LIMITS).forEach(([field, limit]) => {
    if (isString(display[field], limit)) {
      clean[field] = display[field];
    }
  });

  if (Array.isArray(display.feeRows)) {
    clean.feeRows = display.feeRows
      .filter((row) => row && isString(row.label, 24) && isString(row.value, 24))
      .slice(0, 3)
      .map((row) => ({ label: row.label, value: row.value }));
  }

  return clean;
};

const sanitizeRequest = (request) => {
  if (!request || typeof request !== 'object') {
    return null;
  }

  const { chainId, data, to, value } = request;
  if (!ADDRESS_PATTERN.test(String(to || '')) || !isString(data, MAX_DATA_LENGTH) || !HEX_PATTERN.test(data)) {
    return null;
  }

  if (!isString(value, 80) || !isFiniteNumber(chainId)) {
    return null;
  }

  return { chainId, data, to, value };
};

const OPTIONAL_FIELD_RULES = {
  approvalRecordId: (value) => isString(value, 80),
  broadcastError: (value) => isString(value, 200),
  confirmedCap: (value) => isString(value, 48),
  feePaid: (value) => isString(value, 24),
  from: (value) => ADDRESS_PATTERN.test(String(value || '')),
  hash: (value) => HASH_PATTERN.test(String(value || '')),
  hashAt: isFiniteNumber,
  mismatch: (value) => typeof value === 'boolean',
  nonce: isFiniteNumber,
  outcome: (value) => OUTCOMES.includes(value),
  outcomeReason: (value) => isString(value, 40),
  raw: (value) => isString(value, MAX_RAW_TRANSACTION_LENGTH) && HEX_PATTERN.test(value),
  replacementHash: (value) => HASH_PATTERN.test(String(value || '')),
  resolvedAt: isFiniteNumber,
  reviewIdentity: (value) => isString(value, 400),
  startBlock: isFiniteNumber
};

// Returns a clean record, or null when a required field is missing or wrong.
export const sanitizeRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const {
    account, chainId, id, path, startedAt, state, type
  } = record;
  if (!isString(id, 80) || !id || !ADDRESS_PATTERN.test(String(account || '')) || !isFiniteNumber(chainId)) {
    return null;
  }

  if (!RECORD_STATES.includes(state) || !RECORD_TYPES.includes(type) || !['E', 'S'].includes(path)) {
    return null;
  }

  if (!isFiniteNumber(startedAt)) {
    return null;
  }

  const request = sanitizeRequest(record.request);
  if (!request) {
    return null;
  }

  const clean = {
    account, chainId, display: sanitizeDisplay(record.display), id, path, request, startedAt, state, type
  };

  Object.entries(OPTIONAL_FIELD_RULES).forEach(([field, isValid]) => {
    if (record[field] !== undefined && record[field] !== null && isValid(record[field])) {
      clean[field] = record[field];
    }
  });

  // A resolved record must say how it ended.
  if (clean.state === 'resolved' && !clean.outcome) {
    return null;
  }

  return clean;
};

export const isUnresolved = (record) => record.state !== 'resolved';

const sameAccount = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();

// The send-blocking rule (G6): an unresolved record for this account and chain
// blocks new bridge, claim, and NFT sends.
export const findBlockingRecord = (records, { account, chainId }) => records
  .filter((record) => isUnresolved(record) && sameAccount(record.account, account) && record.chainId === chainId)
  .sort((left, right) => right.startedAt - left.startedAt)[0] || null;

const getDefaultStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (error) {
    return null;
  }
};

const getDefaultLocks = () => (typeof navigator === 'undefined' ? null : navigator.locks || null);

export const createSubmittedOperations = ({
  locks = getDefaultLocks(),
  now = () => Date.now(),
  storage = getDefaultStorage(),
  win = typeof window === 'undefined' ? null : window
} = {}) => {
  let snapshot = {
    canMutateRecords: false,
    ready: false,
    records: [],
    restoredUnresolvedIds: new Set()
  };
  const listeners = new Set();
  const transitionListeners = new Set();

  const readRecordsFromStorage = () => {
    if (!storage) {
      throw new StorageUnavailableError();
    }

    let parsed;
    try {
      parsed = JSON.parse(storage.getItem(SUBMITTED_OPERATIONS_STORAGE_KEY) || '[]');
    } catch (error) {
      parsed = [];
    }

    return (Array.isArray(parsed) ? parsed : []).map(sanitizeRecord).filter(Boolean);
  };

  const writeRecordsToStorage = (records) => {
    if (!storage) {
      throw new StorageUnavailableError();
    }

    try {
      storage.setItem(SUBMITTED_OPERATIONS_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      throw new StorageUnavailableError();
    }
  };

  const setSnapshot = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const emitTransition = (event) => {
    transitionListeners.forEach((listener) => listener(event));
  };

  const canLock = () => typeof locks?.request === 'function';

  // Runs a synchronous callback while this tab holds the storage lock. The
  // callback must not await: it reads, decides, writes, and may start a wallet
  // request, but the lock is released before that request answers.
  const runExclusive = (callback) => {
    if (!canLock()) {
      return Promise.reject(new StorageUnavailableError());
    }

    return locks.request(STORAGE_LOCK_NAME, { mode: 'exclusive' }, () => {
      const context = {
        read: readRecordsFromStorage,
        write: (records) => {
          writeRecordsToStorage(records);
          setSnapshot({ records });
        }
      };
      // Wrap the result, so a returned promise does not hold the lock.
      return { value: callback(context) };
    }).then((result) => result.value);
  };

  const pruneResolved = (records) => {
    const referenced = new Set(records.filter(isUnresolved).map((record) => record.approvalRecordId).filter(Boolean));
    const cutoff = now() - RESOLVED_RECORD_RETENTION_MS;
    return records.filter((record) => (
      isUnresolved(record) || referenced.has(record.id) || (record.resolvedAt ?? record.startedAt) >= cutoff
    ));
  };

  const init = async () => {
    let records = [];
    let storageWorks = true;

    try {
      records = readRecordsFromStorage();
    } catch (error) {
      storageWorks = false;
    }

    const restoredUnresolvedIds = new Set(records.filter(isUnresolved).map((record) => record.id));
    const canMutateRecords = storageWorks && canLock();

    // `ready` is set on every path, so routing never waits forever (3.2).
    setSnapshot({ canMutateRecords, ready: true, records, restoredUnresolvedIds });

    if (canMutateRecords) {
      try {
        await runExclusive(({ read, write }) => {
          const fresh = read();
          const pruned = pruneResolved(fresh);
          if (pruned.length !== fresh.length) {
            write(pruned);
          }
        });
      } catch (error) {
        setSnapshot({ canMutateRecords: false });
      }
    }

    return snapshot;
  };

  // Writes the intent of a new request, after the send-blocking rule. Throws
  // SendBlockedError or StorageUnavailableError; nothing then reaches a wallet.
  const writeIntentInside = (context, record, { allowBlocked = false } = {}) => {
    const fresh = context.read();
    const blocking = findBlockingRecord(fresh, record);

    if (blocking && !allowBlocked) {
      throw new SendBlockedError(blocking);
    }

    const clean = sanitizeRecord({ ...record, state: 'awaiting-wallet' });
    if (!clean) {
      throw new Error('The transfer record is not valid.');
    }

    context.write([...fresh, clean]);
    emitTransition({ from: null, recordId: clean.id, to: 'awaiting-wallet' });
    return clean;
  };

  // Moves one record forward. Returns the new record, or null when the record
  // is missing or not in one of the expected states.
  const transition = async (recordId, { from, patch = {}, to }) => {
    if (!snapshot.canMutateRecords) {
      return null;
    }

    let changed = null;
    let previousState = null;

    await runExclusive(({ read, write }) => {
      const fresh = read();
      const index = fresh.findIndex((record) => record.id === recordId);
      if (index === -1) {
        return;
      }

      const current = fresh[index];
      if (current.state === 'resolved' || !from.includes(current.state)) {
        return;
      }

      if (RECORD_STATES.indexOf(to) < RECORD_STATES.indexOf(current.state)) {
        return;
      }

      const next = sanitizeRecord({
        ...current,
        ...patch,
        state: to,
        ...(to === 'resolved' ? { resolvedAt: now() } : {})
      });
      if (!next) {
        return;
      }

      previousState = current.state;
      const records = [...fresh];
      records[index] = next;
      write(records);
      changed = next;
    });

    if (changed) {
      emitTransition({
        from: previousState, outcome: changed.outcome, recordId, to: changed.state
      });
    }

    return changed;
  };

  // Another tab changed the records. Show them; the state rules still apply,
  // because every change reads fresh data inside the lock.
  const handleStorageEvent = (event) => {
    if (event.key !== SUBMITTED_OPERATIONS_STORAGE_KEY) {
      return;
    }

    try {
      setSnapshot({ records: readRecordsFromStorage() });
    } catch (error) {
      // Keep the current snapshot.
    }
  };

  win?.addEventListener?.('storage', handleStorageEvent);

  return {
    findBlockingRecord: (scope) => findBlockingRecord(snapshot.records, scope),
    getRecord: (recordId) => snapshot.records.find((record) => record.id === recordId) || null,
    getSnapshot: () => snapshot,
    init,
    onTransition: (listener) => {
      transitionListeners.add(listener);
      return () => transitionListeners.delete(listener);
    },
    runExclusive,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    transition,
    writeIntentInside
  };
};
