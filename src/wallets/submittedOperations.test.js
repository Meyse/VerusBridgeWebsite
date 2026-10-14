import { createFakeLocks } from './operationLock';
import {
  RESOLVED_RECORD_RETENTION_MS,
  SUBMITTED_OPERATIONS_STORAGE_KEY,
  SendBlockedError,
  StorageUnavailableError,
  createSubmittedOperations,
  sanitizeRecord
} from './submittedOperations';

const ACCOUNT = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
const OTHER_ACCOUNT = '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF';
const BRIDGE = '0x98f58684b05E7d40719E61955015aF91eF7e77d3';
const HASH = `0x${'ab'.repeat(32)}`;
const DAY = 24 * 60 * 60 * 1000;

const createStorage = ({ failWrites = false } = {}) => {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites) {
        throw new Error('QuotaExceededError');
      }
      data.set(key, value);
    }
  };
};

const createRecord = (overrides = {}) => ({
  account: ACCOUNT,
  chainId: 11155111,
  display: { send: '0.005 ETH', walletName: 'MetaMask' },
  id: 'record-1',
  path: 'E',
  request: { chainId: 11155111, data: '0x1234', to: BRIDGE, value: '0x0' },
  startedAt: 1000,
  type: 'transfer',
  ...overrides
});

const createStore = (options = {}) => createSubmittedOperations({
  locks: createFakeLocks(),
  now: () => 1000,
  storage: createStorage(),
  win: null,
  ...options
});

const writeIntent = (store, record, options) => store.runExclusive((context) => store.writeIntentInside(context, record, options));

const readStored = (storage) => JSON.parse(storage.getItem(SUBMITTED_OPERATIONS_STORAGE_KEY) || '[]');

describe('submitted operations', () => {
  test('is ready after init, also when storage cannot be read', async () => {
    const store = createStore({ storage: null });

    await store.init();

    expect(store.getSnapshot()).toMatchObject({ canMutateRecords: false, ready: true, records: [] });
  });

  test('writes the intent before dispatch and refuses a send while a record is unresolved', async () => {
    const store = createStore();
    await store.init();

    await writeIntent(store, createRecord());

    expect(store.getSnapshot().records).toHaveLength(1);
    expect(store.getSnapshot().records[0].state).toBe('awaiting-wallet');
    await expect(writeIntent(store, createRecord({ id: 'record-2' }))).rejects.toBeInstanceOf(SendBlockedError);
    expect(store.getSnapshot().records).toHaveLength(1);
  });

  test('allows the explicit override while the old record stays tracked', async () => {
    const store = createStore();
    await store.init();
    await writeIntent(store, createRecord());

    await writeIntent(store, createRecord({ id: 'record-2' }), { allowBlocked: true });

    expect(store.getSnapshot().records.map((record) => record.id)).toEqual(['record-1', 'record-2']);
  });

  test('does not block another account or another chain', async () => {
    const store = createStore();
    await store.init();
    await writeIntent(store, createRecord());

    await writeIntent(store, createRecord({ account: OTHER_ACCOUNT, id: 'other-account' }));
    await writeIntent(store, createRecord({ chainId: 1, id: 'other-chain', request: { chainId: 1, data: '0x', to: BRIDGE, value: '0x0' } }));

    expect(store.getSnapshot().records).toHaveLength(3);
  });

  test('stops with the storage message when the intent cannot be written', async () => {
    const store = createStore({ storage: createStorage({ failWrites: true }) });
    await store.init();

    await expect(writeIntent(store, createRecord())).rejects.toBeInstanceOf(StorageUnavailableError);
  });

  test('moves states forward only and never changes a resolved record', async () => {
    const store = createStore();
    await store.init();
    await writeIntent(store, createRecord());

    await expect(store.transition('record-1', { from: ['awaiting-wallet'], patch: { hash: HASH }, to: 'submitted' }))
      .resolves.toMatchObject({ hash: HASH, state: 'submitted' });
    await expect(store.transition('record-1', { from: ['awaiting-wallet'], to: 'signed' })).resolves.toBeNull();
    await expect(store.transition('record-1', { from: ['submitted'], to: 'signed' })).resolves.toBeNull();

    await store.transition('record-1', { from: ['submitted'], patch: { outcome: 'success' }, to: 'resolved' });
    await expect(store.transition('record-1', { from: ['resolved', 'submitted'], patch: { outcome: 'reverted' }, to: 'resolved' }))
      .resolves.toBeNull();
    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'success', resolvedAt: 1000, state: 'resolved' });
  });

  test('reports each transition with its old and new state', async () => {
    const store = createStore();
    const events = [];
    store.onTransition((event) => events.push(event));
    await store.init();
    await writeIntent(store, createRecord());

    await store.transition('record-1', { from: ['awaiting-wallet'], patch: { outcome: 'rejected', outcomeReason: 'user' }, to: 'resolved' });

    expect(events).toEqual([
      { from: null, recordId: 'record-1', to: 'awaiting-wallet' },
      { from: 'awaiting-wallet', outcome: 'rejected', recordId: 'record-1', to: 'resolved' }
    ]);
  });

  test('keeps both changes when two tabs write at the same time', async () => {
    const storage = createStorage();
    const registry = new Map();
    const firstTab = createStore({ locks: createFakeLocks(registry), storage });
    const secondTab = createStore({ locks: createFakeLocks(registry), storage });
    await firstTab.init();
    await writeIntent(firstTab, createRecord());
    await secondTab.init();

    await Promise.all([
      firstTab.transition('record-1', { from: ['awaiting-wallet'], patch: { hash: HASH }, to: 'submitted' }),
      writeIntent(secondTab, createRecord({ account: OTHER_ACCOUNT, id: 'record-2' }))
    ]);

    expect(readStored(storage).map((record) => [record.id, record.state])).toEqual([
      ['record-1', 'submitted'],
      ['record-2', 'awaiting-wallet']
    ]);
  });

  test('without navigator.locks it shows restored records read-only', async () => {
    const storage = createStorage();
    storage.setItem(SUBMITTED_OPERATIONS_STORAGE_KEY, JSON.stringify([{ ...createRecord(), state: 'submitted', hash: HASH }]));
    const store = createStore({ locks: null, storage });

    await store.init();

    expect(store.getSnapshot()).toMatchObject({ canMutateRecords: false, ready: true });
    expect(store.getSnapshot().records).toHaveLength(1);
    await expect(store.transition('record-1', { from: ['submitted'], patch: { outcome: 'success' }, to: 'resolved' }))
      .resolves.toBeNull();
    expect(readStored(storage)[0].state).toBe('submitted');
  });

  test('remembers which records were unresolved when it restored them', async () => {
    const storage = createStorage();
    storage.setItem(SUBMITTED_OPERATIONS_STORAGE_KEY, JSON.stringify([
      { ...createRecord(), hash: HASH, state: 'submitted' },
      { ...createRecord({ id: 'done' }), outcome: 'success', resolvedAt: 900, state: 'resolved' }
    ]));
    const store = createStore({ storage });

    await store.init();

    expect([...store.getSnapshot().restoredUnresolvedIds]).toEqual(['record-1']);
  });

  test('deletes resolved records after 30 days, keeps unresolved ones and approvals they reference', async () => {
    const storage = createStorage();
    const old = 1000;
    storage.setItem(SUBMITTED_OPERATIONS_STORAGE_KEY, JSON.stringify([
      { ...createRecord({ id: 'old-resolved' }), outcome: 'success', resolvedAt: old, state: 'resolved' },
      {
        ...createRecord({ id: 'old-approval', type: 'erc20-approval' }), outcome: 'success', resolvedAt: old, state: 'resolved'
      },
      { ...createRecord({ approvalRecordId: 'old-approval', id: 'pending-transfer' }), hash: HASH, state: 'submitted' },
      { ...createRecord({ id: 'recent' }), outcome: 'reverted', resolvedAt: old + DAY, state: 'resolved' }
    ]));
    const store = createStore({ now: () => old + RESOLVED_RECORD_RETENTION_MS + 1, storage });

    await store.init();

    expect(readStored(storage).map((record) => record.id)).toEqual(['old-approval', 'pending-transfer', 'recent']);
  });

  test('drops a stored field with a wrong type or length, and a record without its required fields', () => {
    const record = sanitizeRecord({
      ...createRecord(),
      display: { destination: 'R'.repeat(101), send: '<b>0.005 ETH</b>', walletName: 42 },
      hash: 'not-a-hash',
      state: 'awaiting-wallet'
    });

    expect(record.display).toEqual({ send: '<b>0.005 ETH</b>' });
    expect(record.hash).toBeUndefined();
    expect(sanitizeRecord({ ...createRecord(), account: 'nope', state: 'awaiting-wallet' })).toBeNull();
    expect(sanitizeRecord({ ...createRecord(), state: 'resolved' })).toBeNull();
  });
});
