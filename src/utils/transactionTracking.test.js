import { Contract, Wallet, utils } from 'ethers';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC20_ABI from 'abis/ERC20Abi.json';
import { DELEGATOR_ADD, EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { createScriptedChain } from 'testUtils/scriptedChain';
import { createFakeLocks } from 'wallets/operationLock';
import { createSubmittedOperations } from 'wallets/submittedOperations';

import { toRecordRequest } from './guardedSend';
import { createTransactionTracker } from './transactionTracking';

const USER = new Wallet(`0x${'0'.repeat(63)}1`);
const TOKEN = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const GWEI = 1000000000;
const delegator = new Contract(DELEGATOR_ADD, DELEGATOR_ABI);
const token = new Contract(TOKEN, ERC20_ABI);

const createStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

const sign = (fields) => USER.signTransaction({
  chainId: EXPECTED_ETHEREUM_CHAIN_ID,
  gasLimit: 300000,
  gasPrice: GWEI,
  nonce: 7,
  value: 0,
  ...fields
});

const feesCall = (x) => ({
  data: delegator.interface.encodeFunctionData('sendfees', [utils.hexZeroPad(utils.hexlify(x), 32), utils.hexZeroPad('0x01', 32)]),
  to: DELEGATOR_ADD
});

// Creates a store with one record in the given state.
const createRecordStore = async ({
  hash, raw, request, state = 'submitted', type = 'claim', ...fields
}) => {
  const store = createSubmittedOperations({ locks: createFakeLocks(), storage: createStorage(), win: null });
  await store.init();
  await store.runExclusive((context) => store.writeIntentInside(context, {
    account: USER.address,
    chainId: EXPECTED_ETHEREUM_CHAIN_ID,
    id: 'record-1',
    path: raw ? 'S' : 'E',
    request,
    startBlock: 100,
    startedAt: 1,
    type,
    ...fields
  }));
  await store.transition('record-1', {
    from: ['awaiting-wallet'],
    patch: { hash, hashAt: 2, ...(raw ? { from: USER.address, nonce: 7, raw } : {}) },
    to: state
  });
  return store;
};

const setup = async (options) => {
  const chain = createScriptedChain({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, startBlock: 100 });
  const store = await createRecordStore(options);
  const tracker = createTransactionTracker({ pollIntervalMs: 20, siteProvider: chain.provider, store });
  return { chain, store, tracker };
};

// ethers checks for replacements once per new block, after a one-second
// pause. A real chain keeps producing blocks, so this one does too.
const mineUntilSettled = async (chain, tracking) => {
  let settled = false;
  tracking.finally(() => {
    settled = true;
  });

  while (!settled) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    if (!settled) {
      chain.mine([]);
    }
  }

  return tracking;
};

const requestOf = (fields) => toRecordRequest({ ...fields, chainId: EXPECTED_ETHEREUM_CHAIN_ID, value: fields.value || 0 });

describe('transaction tracking', () => {
  test('a mined transaction with status 1 is a success, with the fee paid', async () => {
    const raw = await sign(feesCall(1));
    const hash = utils.keccak256(raw);
    const { chain, store, tracker } = await setup({ hash, request: requestOf(feesCall(1)) });
    chain.addPending(raw);

    const tracking = tracker.track('record-1');
    chain.mine([raw]);
    await tracking;

    // 21,000 gas x 1 gwei = 0.000021 ETH.
    expect(store.getRecord('record-1')).toMatchObject({ feePaid: '0.000021 ETH', outcome: 'success', state: 'resolved' });
  });

  test('a mined revert is a failure', async () => {
    const raw = await sign(feesCall(1));
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(raw), request: requestOf(feesCall(1)) });
    chain.addPending(raw);

    const tracking = tracker.track('record-1');
    chain.mine([{ raw, status: 0 }]);
    await tracking;

    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'reverted', state: 'resolved' });
  });

  test('repriced, then mined with status 1: success with the new hash', async () => {
    const original = await sign(feesCall(1));
    const repriced = await sign({ ...feesCall(1), gasPrice: 2 * GWEI });
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(original), request: requestOf(feesCall(1)) });
    chain.addPending(original);

    const tracking = tracker.track('record-1');
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    chain.forget(utils.keccak256(original));
    chain.mine([repriced]);
    await mineUntilSettled(chain, tracking);

    expect(store.getRecord('record-1')).toMatchObject({
      outcome: 'success', replacementHash: utils.keccak256(repriced), state: 'resolved'
    });
  }, 15000);

  test('repriced, then reverted: failure', async () => {
    const original = await sign(feesCall(1));
    const repriced = await sign({ ...feesCall(1), gasPrice: 2 * GWEI });
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(original), request: requestOf(feesCall(1)) });
    chain.addPending(original);

    const tracking = tracker.track('record-1');
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    chain.forget(utils.keccak256(original));
    chain.mine([{ raw: repriced, status: 0 }]);
    await mineUntilSettled(chain, tracking);

    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'reverted' });
  }, 15000);

  test('cancelled with a zero-value transaction to self', async () => {
    const original = await sign(feesCall(1));
    const cancel = await sign({ data: '0x', gasPrice: 2 * GWEI, to: USER.address });
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(original), request: requestOf(feesCall(1)) });
    chain.addPending(original);

    const tracking = tracker.track('record-1');
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    chain.forget(utils.keccak256(original));
    chain.mine([cancel]);
    await mineUntilSettled(chain, tracking);

    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'cancelled', replacementHash: utils.keccak256(cancel) });
  }, 15000);

  test('replaced by another transaction that itself calls the bridge', async () => {
    const original = await sign(feesCall(1));
    const other = await sign({ ...feesCall(2), gasPrice: 2 * GWEI });
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(original), request: requestOf(feesCall(1)) });
    chain.addPending(original);

    const tracking = tracker.track('record-1');
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    chain.forget(utils.keccak256(original));
    chain.mine([other]);
    await mineUntilSettled(chain, tracking);

    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'replaced', replacementHash: utils.keccak256(other) });
  }, 15000);

  test('a pending transaction that differs from the review is a workflow stop, then confirmed-unexpected', async () => {
    const sent = await sign(feesCall(2));
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(sent), request: requestOf(feesCall(1)) });
    chain.addPending(sent);

    const tracking = tracker.track('record-1');
    await new Promise((resolve) => { setTimeout(resolve, 80); });

    expect(store.getRecord('record-1')).toMatchObject({ mismatch: true, state: 'observed' });

    chain.mine([sent]);
    await tracking;
    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'confirmed-unexpected', state: 'resolved' });
  });

  test('a restored raw transaction that does not match its hash is deleted, and tracking uses the hash', async () => {
    const sent = await sign(feesCall(1));
    const unrelatedRaw = await sign({ ...feesCall(1), nonce: 8 });
    const { chain, store, tracker } = await setup({
      hash: utils.keccak256(sent), raw: unrelatedRaw, request: requestOf(feesCall(1))
    });
    chain.addPending(sent);

    const tracking = tracker.track('record-1');
    chain.mine([sent]);
    await tracking;

    expect(store.getRecord('record-1').raw).toBeUndefined();
    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'success' });
  });

  test('after a reload, a replacement is still found from the stored nonce and start block', async () => {
    const original = await sign(feesCall(1));
    const other = await sign({ ...feesCall(2), gasPrice: 2 * GWEI });
    const { chain, store } = await setup({
      from: USER.address, hash: utils.keccak256(original), nonce: 7, request: requestOf(feesCall(1)), state: 'observed'
    });
    // The page was closed. Meanwhile, the replacement was mined, and the RPC
    // forgot the original transaction.
    chain.mine([other]);
    const tracker = createTransactionTracker({ pollIntervalMs: 20, siteProvider: chain.provider, store });

    const tracking = tracker.track('record-1');
    await mineUntilSettled(chain, tracking);

    expect(store.getRecord('record-1')).toMatchObject({ outcome: 'replaced', replacementHash: utils.keccak256(other) });
  }, 15000);

  test('an approval with an edited amount succeeds and records the confirmed cap', async () => {
    const approveCall = { data: token.interface.encodeFunctionData('approve', [DELEGATOR_ADD, 7500000]), to: TOKEN };
    const raw = await sign(approveCall);
    const { chain, store, tracker } = await setup({
      approvalDecimals: 6,
      approvalSymbol: 'USDC',
      hash: utils.keccak256(raw),
      request: requestOf({ data: token.interface.encodeFunctionData('approve', [DELEGATOR_ADD, 5000000]), to: TOKEN }),
      type: 'erc20-approval'
    });
    chain.addPending(raw);

    const tracking = tracker.track('record-1');
    chain.mine([raw]);
    await tracking;

    expect(store.getRecord('record-1')).toMatchObject({ confirmedCap: '7.5 USDC', outcome: 'success' });
  });

  test('check again re-broadcasts a validated stored raw transaction only when it may', async () => {
    const raw = await sign(feesCall(1));
    const { chain, store, tracker } = await setup({ hash: utils.keccak256(raw), raw, request: requestOf(feesCall(1)) });
    const send = vi.spyOn(chain.provider, 'send');

    await tracker.checkAgain('record-1', { canBroadcast: false });
    expect(send.mock.calls.filter(([method]) => method === 'eth_sendRawTransaction')).toHaveLength(0);

    await tracker.checkAgain('record-1', { canBroadcast: true });
    expect(send.mock.calls.filter(([method]) => method === 'eth_sendRawTransaction')).toHaveLength(1);
    expect(store.getRecord('record-1').state).toBe('submitted');
  });
});
