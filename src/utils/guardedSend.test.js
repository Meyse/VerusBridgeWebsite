import { EventEmitter } from 'events';

import { BigNumber, Contract, Wallet, utils } from 'ethers';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC20_ABI from 'abis/ERC20Abi.json';
import { DELEGATOR_ADD, EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { createFakeLocks } from 'wallets/operationLock';
import { createSubmittedOperations } from 'wallets/submittedOperations';
import { getWalletSession, resetWalletSessionForTests, syncWalletSession } from 'wallets/walletSession';

import {
  CHAIN_CHECK_TIMEOUT_MS,
  GuardStopError,
  RequestDiscardedError,
  UnresolvedRequestError,
  WalletRequestRejectedError,
  classifyWalletRequestError,
  guardedSend
} from './guardedSend';

const USER = new Wallet(`0x${'0'.repeat(63)}1`);
const OTHER = new Wallet(`0x${'0'.repeat(63)}2`);
const TOKEN = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const CHAIN_HEX = utils.hexValue(EXPECTED_ETHEREUM_CHAIN_ID);
const ZERO = '0x0000000000000000000000000000000000000000';
// The test build can be mainnet or a testnet. This is always another chain.
const OTHER_CHAIN_ID = EXPECTED_ETHEREUM_CHAIN_ID === 1 ? 11155111 : 1;
const OTHER_CHAIN_HEX = utils.hexValue(OTHER_CHAIN_ID);

const reserveTransfer = {
  currencyvalue: { amount: 500000, currency: '0x67460C2f56774eD27EeB8685f29f6CEC0B090B00' },
  destcurrencyid: '0xffEce948b8A38bBcC813411D2597f7f8485a0689',
  destination: { destinationaddress: '0x751e76e8199196d454941c45d1b3a323f1433bd6', destinationtype: 2 },
  destsystemid: ZERO,
  feecurrencyid: '0x67460C2f56774eD27EeB8685f29f6CEC0B090B00',
  fees: 2000000,
  flags: 1,
  secondreserveid: ZERO,
  version: 1
};

const delegator = new Contract(DELEGATOR_ADD, DELEGATOR_ABI);
const token = new Contract(TOKEN, ERC20_ABI);

const createStorage = ({ failWrites = false } = {}) => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites) {
        throw new Error('QuotaExceededError');
      }
      data.set(key, value);
    }
  };
};

const createSiteProvider = ({ broadcast, latest = 7, pending = 7 } = {}) => ({
  estimateGas: vi.fn().mockResolvedValue(BigNumber.from(300000)),
  getBlockNumber: vi.fn().mockResolvedValue(1234),
  getCode: vi.fn().mockResolvedValue('0x6000'),
  getTransactionCount: vi.fn(async (_account, tag) => (tag === 'pending' ? pending : latest)),
  send: vi.fn(async (method, params) => {
    if (method !== 'eth_sendRawTransaction') {
      throw new Error(`Unexpected site call ${method}`);
    }
    return broadcast ? broadcast(params[0]) : utils.keccak256(params[0]);
  })
});

// Signs the JSON-RPC request the way a wallet does, with real ethers.
const signRequest = (signer, request, { chainId = EXPECTED_ETHEREUM_CHAIN_ID, nonce = 7, ...changes } = {}) => signer.signTransaction({
  chainId,
  data: request.data,
  gasLimit: request.gas,
  gasPrice: 1000000000,
  nonce,
  to: request.to,
  value: request.value,
  ...changes
});

const createWalletProvider = ({ chainId = CHAIN_HEX, onChainId, onSend, onSign } = {}) => {
  const calls = [];
  return {
    calls,
    methods: () => calls.map((call) => call.method),
    request: vi.fn(async ({ method, params }) => {
      calls.push({ method, params });
      if (method === 'eth_accounts') {
        return [USER.address];
      }
      if (method === 'eth_chainId') {
        return onChainId ? onChainId() : chainId;
      }
      if (method === 'eth_sendTransaction') {
        return onSend ? onSend(params[0]) : `0x${'ab'.repeat(32)}`;
      }
      if (method === 'eth_signTransaction') {
        return onSign ? onSign(params[0]) : signRequest(USER, params[0]);
      }
      throw new Error(`Unexpected wallet call ${method}`);
    })
  };
};

const setup = async ({ provider, rdns = 'io.metamask', storage = createStorage() } = {}) => {
  const connector = new EventEmitter();
  syncWalletSession({
    account: USER.address,
    chainId: EXPECTED_ETHEREUM_CHAIN_ID,
    connector,
    provider,
    wallet: { name: rdns === 'io.metamask' ? 'MetaMask' : 'Brave Wallet', rdns }
  });
  const store = createSubmittedOperations({ locks: createFakeLocks(), storage, win: null });
  await store.init();
  return { connector, session: getWalletSession(), store };
};

const sendTransfer = (context, options = {}) => guardedSend({
  args: [reserveTransfer],
  contract: delegator,
  gasLimitFloor: 1000000,
  method: 'sendTransfer',
  overrides: { value: '0x2386f26fc10000' },
  session: context.session,
  siteProvider: context.siteProvider,
  store: context.store,
  type: 'transfer',
  ...options
});

const sentRequest = (provider, method) => provider.calls.find((call) => call.method === method)?.params[0];

describe('guardedSend', () => {
  beforeEach(() => {
    resetWalletSessionForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('every wallet gets the same request for one reviewed transfer (8.1)', async () => {
    const metaMask = createWalletProvider();
    const brave = createWalletProvider();

    const first = await setup({ provider: metaMask });
    await sendTransfer({ ...first, siteProvider: createSiteProvider() });
    resetWalletSessionForTests();
    const second = await setup({ provider: brave, rdns: 'com.brave.wallet' });
    await sendTransfer({ ...second, siteProvider: createSiteProvider() });

    const sent = sentRequest(metaMask, 'eth_sendTransaction');
    const signed = sentRequest(brave, 'eth_signTransaction');
    ['chainId', 'data', 'from', 'to', 'value'].forEach((field) => {
      expect(signed[field]).toEqual(sent[field]);
    });
    expect(sent.chainId).toBe(CHAIN_HEX);
    expect(utils.getAddress(sent.to)).toBe(utils.getAddress(DELEGATOR_ADD));
  });

  test('path E: MetaMask gets eth_sendTransaction with chainId and never eth_signTransaction', async () => {
    const provider = createWalletProvider();
    const context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    const result = await sendTransfer(context);

    expect(provider.methods()).toContain('eth_sendTransaction');
    expect(provider.methods()).not.toContain('eth_signTransaction');
    expect(context.siteProvider.send).not.toHaveBeenCalled();
    expect(context.store.getRecord(result.recordId)).toMatchObject({ hash: result.hash, path: 'E', state: 'submitted' });
  });

  test('path S: Brave gets eth_signTransaction, and the site broadcasts the raw transaction', async () => {
    const provider = createWalletProvider();
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    const result = await sendTransfer(context);
    const raw = context.siteProvider.send.mock.calls[0][1][0];

    expect(provider.methods()).toContain('eth_signTransaction');
    expect(provider.methods()).not.toContain('eth_sendTransaction');
    expect(result.hash).toBe(utils.keccak256(raw));
    expect(context.store.getRecord(result.recordId)).toMatchObject({ nonce: 7, path: 'S', raw, state: 'submitted' });
  });

  test('refuses a wallet without a send path before any wallet prompt', async () => {
    const provider = createWalletProvider();
    const context = { ...(await setup({ provider, rdns: 'io.rabby' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toThrow(
      'The bridge can send only with MetaMask or Brave Wallet. Connect one of them to send.'
    );
    expect(provider.calls).toEqual([]);
    expect(context.store.getSnapshot().records).toEqual([]);
  });

  test('writes the awaiting-wallet record before the wallet request', async () => {
    let stateAtRequest = null;
    let context;
    const provider = createWalletProvider({
      onSend: () => {
        stateAtRequest = context.store.getSnapshot().records[0]?.state;
        return `0x${'cd'.repeat(32)}`;
      }
    });
    context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    await sendTransfer(context);

    expect(stateAtRequest).toBe('awaiting-wallet');
  });

  test('a rejection (4001) resolves the intent as rejected by the user', async () => {
    const provider = createWalletProvider({
      onSend: () => Promise.reject(Object.assign(new Error('User denied'), { code: 4001 }))
    });
    const context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toBeInstanceOf(WalletRequestRejectedError);
    expect(context.store.getSnapshot().records[0]).toMatchObject({ outcome: 'rejected', outcomeReason: 'user', state: 'resolved' });
  });

  test('an unsupported sign request (4200 or -32601) resolves as rejected, unsupported, and nothing is sent', async () => {
    const provider = createWalletProvider({
      onSign: () => Promise.reject(Object.assign(new Error('Unsupported'), { code: -32601 }))
    });
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toThrow('Brave Wallet does not support this request. Update Brave Wallet, then try again.');
    expect(context.store.getSnapshot().records[0]).toMatchObject({ outcomeReason: 'unsupported', state: 'resolved' });
    expect(provider.methods()).not.toContain('eth_sendTransaction');
    expect(context.siteProvider.send).not.toHaveBeenCalled();
  });

  test('any other error leaves the record unresolved, because the wallet can have broadcast', async () => {
    const provider = createWalletProvider({ onSend: () => Promise.reject(new Error('Internal JSON-RPC error')) });
    const context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toBeInstanceOf(UnresolvedRequestError);
    expect(context.store.getSnapshot().records[0].state).toBe('awaiting-wallet');
  });

  test('MetaMask rejecting a chainId mismatch gets exactly one request and no retry without chainId', async () => {
    const provider = createWalletProvider({
      onSend: () => Promise.reject(Object.assign(new Error('chainId must match the network client'), { code: -32602 }))
    });
    const context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toBeInstanceOf(UnresolvedRequestError);
    expect(provider.methods().filter((method) => method === 'eth_sendTransaction')).toHaveLength(1);
  });

  test('a Brave hardware account returns a hash: the site tracks it and broadcasts nothing', async () => {
    const hash = `0x${'ef'.repeat(32)}`;
    const provider = createWalletProvider({ onSign: () => hash });
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    const result = await sendTransfer(context);

    expect(result.hash).toBe(hash);
    expect(context.siteProvider.send).not.toHaveBeenCalled();
    expect(context.store.getRecord(result.recordId)).toMatchObject({ hash, state: 'submitted' });
  });

  test('a network change while the sign request is open latches the operation, and the raw transaction is discarded', async () => {
    let context;
    const onLatch = vi.fn();
    const provider = createWalletProvider({
      onSign: (request) => {
        context.connector.emit('Web3ReactUpdate', { chainId: OTHER_CHAIN_HEX });
        return signRequest(USER, request);
      }
    });
    context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context, { events: { onLatch } })).rejects.toBeInstanceOf(RequestDiscardedError);
    expect(onLatch).toHaveBeenCalledWith(expect.objectContaining({ reason: 'network' }));
    expect(context.siteProvider.send).not.toHaveBeenCalled();
    expect(context.store.getSnapshot().records[0]).toMatchObject({ outcome: 'discarded', outcomeReason: 'latch' });
  });

  test.each([
    ['another chain in the follow-up answer', { onChainId: () => OTHER_CHAIN_HEX }, 'network'],
    ['a rejected follow-up answer', { onChainId: () => Promise.reject(new Error('no')) }, 'unconfirmed'],
    ['a malformed follow-up answer', { onChainId: () => 'not-a-chain' }, 'unconfirmed']
  ])('latches on %s', async (_label, providerOptions, reason) => {
    let calls = 0;
    const onChainId = providerOptions.onChainId;
    const provider = createWalletProvider({
      onChainId: () => {
        calls += 1;
        return calls === 1 ? CHAIN_HEX : onChainId();
      }
    });
    const onLatch = vi.fn();
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context, { events: { onLatch } })).rejects.toBeInstanceOf(RequestDiscardedError);
    expect(onLatch).toHaveBeenCalledWith(expect.objectContaining({ reason }));
    expect(context.siteProvider.send).not.toHaveBeenCalled();
  });

  test('latches when the follow-up network answer does not arrive in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let calls = 0;
    const provider = createWalletProvider({
      onChainId: () => {
        calls += 1;
        return calls === 1 ? CHAIN_HEX : new Promise(() => {});
      }
    });
    const onLatch = vi.fn();
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    const sending = sendTransfer(context, { events: { onLatch } });
    const assertion = expect(sending).rejects.toBeInstanceOf(RequestDiscardedError);
    await vi.advanceTimersByTimeAsync(CHAIN_CHECK_TIMEOUT_MS);
    await assertion;
    expect(onLatch).toHaveBeenCalledWith(expect.objectContaining({ reason: 'unconfirmed' }));
  });

  test.each([
    ['signed for another network', { chainId: OTHER_CHAIN_ID }, 'chain', 'Brave Wallet signed for another network. Nothing was sent.'],
    ['another recipient', { to: TOKEN }, 'fields', 'Brave Wallet changed the transaction. Nothing was sent.'],
    ['another value', { value: '0x01' }, 'fields', 'Brave Wallet changed the transaction. Nothing was sent.'],
    ['other calldata', { data: '0x1234' }, 'fields', 'Brave Wallet changed the transaction. Nothing was sent.'],
    ['another nonce', { nonce: 9 }, 'nonce', 'Brave Wallet and the bridge do not agree on the next transaction number.']
  ])('discards a signed transaction with %s', async (_label, changes, reason, message) => {
    const provider = createWalletProvider({ onSign: (request) => signRequest(USER, request, changes) });
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toThrow(message);
    expect(context.siteProvider.send).not.toHaveBeenCalled();
    expect(context.store.getSnapshot().records[0]).toMatchObject({ outcomeReason: reason, state: 'resolved' });
    expect(context.store.getSnapshot().records[0].raw).toBeUndefined();
  });

  test('discards a transaction signed by another account', async () => {
    const provider = createWalletProvider({ onSign: (request) => signRequest(OTHER, request) });
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toBeInstanceOf(RequestDiscardedError);
    expect(context.siteProvider.send).not.toHaveBeenCalled();
  });

  test('discards when the account has an earlier transaction that is not confirmed', async () => {
    const provider = createWalletProvider();
    const context = {
      ...(await setup({ provider, rdns: 'com.brave.wallet' })),
      siteProvider: createSiteProvider({ latest: 7, pending: 8 })
    };

    await expect(sendTransfer(context)).rejects.toThrow('This account has a transaction that is not confirmed yet. Nothing was sent.');
    expect(context.siteProvider.send).not.toHaveBeenCalled();
  });

  test('broadcasts an ERC-20 approval whose amount the user edited, because G5 decides later', async () => {
    const provider = createWalletProvider({
      onSign: (request) => signRequest(USER, request, {
        data: token.interface.encodeFunctionData('approve', [DELEGATOR_ADD, 999])
      })
    });
    const context = { ...(await setup({ provider, rdns: 'com.brave.wallet' })), siteProvider: createSiteProvider() };

    const result = await guardedSend({
      args: [DELEGATOR_ADD, 5],
      contract: token,
      gasLimitFloor: 100000,
      method: 'approve',
      session: context.session,
      siteProvider: context.siteProvider,
      store: context.store,
      type: 'erc20-approval'
    });

    expect(context.siteProvider.send).toHaveBeenCalledTimes(1);
    expect(context.store.getRecord(result.recordId).state).toBe('submitted');
  });

  test('sends nothing to the wallet when the intent cannot be written', async () => {
    const provider = createWalletProvider();
    const context = {
      ...(await setup({ provider, storage: createStorage({ failWrites: true }) })),
      siteProvider: createSiteProvider()
    };

    await expect(sendTransfer(context)).rejects.toThrow('This browser does not let the site save data');
    expect(provider.methods()).not.toContain('eth_sendTransaction');
  });

  test('keeps the record open and reports a failed broadcast', async () => {
    const provider = createWalletProvider();
    const onBroadcastFailure = vi.fn();
    const context = {
      ...(await setup({ provider, rdns: 'com.brave.wallet' })),
      siteProvider: createSiteProvider({ broadcast: () => Promise.reject(new Error('already known')) })
    };

    const result = await sendTransfer(context, { events: { onBroadcastFailure } });

    expect(result.broadcastFailed).toBe(true);
    expect(onBroadcastFailure).toHaveBeenCalledTimes(1);
    expect(context.store.getRecord(result.recordId).state).toBe('signed');
  });

  test('stops before the wallet request when the session changes during the checks', async () => {
    let context;
    const provider = createWalletProvider({
      onChainId: () => {
        context.connector.emit('Web3ReactUpdate', { account: OTHER.address });
        return CHAIN_HEX;
      }
    });
    context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };

    await expect(sendTransfer(context)).rejects.toBeInstanceOf(GuardStopError);
    expect(provider.methods()).not.toContain('eth_sendTransaction');
    expect(context.store.getSnapshot().records).toEqual([]);
  });

  test('refuses a send while another record of the account is unresolved', async () => {
    const provider = createWalletProvider();
    const context = { ...(await setup({ provider })), siteProvider: createSiteProvider() };
    await sendTransfer(context);

    await expect(sendTransfer(context)).rejects.toThrow('A transfer from this account is not confirmed yet.');
    expect(provider.methods().filter((method) => method === 'eth_sendTransaction')).toHaveLength(1);
  });

  test('ethers 5.8 rejects chainId as a contract override, so it is added after population', async () => {
    await expect(delegator.populateTransaction.sendTransfer(reserveTransfer, { chainId: EXPECTED_ETHEREUM_CHAIN_ID }))
      .rejects.toThrow(/cannot override "chainId"/);
  });
});

describe('classifyWalletRequestError', () => {
  test.each([
    [{ code: 4001 }, { kind: 'rejected', reason: 'user' }],
    [{ code: 'ACTION_REJECTED' }, { kind: 'rejected', reason: 'user' }],
    [{ error: { code: 4001 } }, { kind: 'rejected', reason: 'user' }],
    [{ code: 4200 }, { kind: 'rejected', reason: 'unsupported' }],
    [{ code: -32601 }, { kind: 'rejected', reason: 'unsupported' }],
    [{ code: -32002 }, { kind: 'unknown' }],
    [new Error('plain'), { kind: 'unknown' }],
    [undefined, { kind: 'unknown' }]
  ])('classifies %j', (error, expected) => {
    expect(classifyWalletRequestError(error)).toEqual(expected);
  });
});
