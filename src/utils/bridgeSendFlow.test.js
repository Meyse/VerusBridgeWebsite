import { EventEmitter } from 'events';

import { BigNumber, Wallet, utils } from 'ethers';

import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { createScriptedChain } from 'testUtils/scriptedChain';
import { createFakeLocks } from 'wallets/operationLock';
import { createSubmittedOperations } from 'wallets/submittedOperations';
import { getWalletSession, resetWalletSessionForTests, syncWalletSession } from 'wallets/walletSession';

import {
  AllowanceTooLowError,
  ApprovalNotConfirmedError,
  runBridgeSend
} from './bridgeSendFlow';
import { GuardStopError } from './guardedSend';
import { createTransactionTracker } from './transactionTracking';

const USER = new Wallet(`0x${'0'.repeat(63)}1`);
const TOKEN = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const ZERO = '0x0000000000000000000000000000000000000000';
const reserveTransfer = {
  currencyvalue: { amount: 500000, currency: TOKEN },
  destcurrencyid: '0xffEce948b8A38bBcC813411D2597f7f8485a0689',
  destination: { destinationaddress: '0x751e76e8199196d454941c45d1b3a323f1433bd6', destinationtype: 2 },
  destsystemid: ZERO,
  feecurrencyid: '0x67460C2f56774eD27EeB8685f29f6CEC0B090B00',
  fees: 2000000,
  flags: 1,
  secondreserveid: ZERO,
  version: 1
};

const createStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

// A MetaMask-like wallet that signs with real ethers and hands the
// transaction to the scripted chain. `mineStatus(request)` decides whether,
// and how, the chain mines it at once.
const createWallet = (chain, { mineStatus = () => null, onSend } = {}) => {
  const calls = [];
  const provider = {
    calls,
    request: vi.fn(async ({ method, params }) => {
      calls.push(method);
      if (method === 'eth_accounts') {
        return [USER.address];
      }
      if (method === 'eth_chainId') {
        return utils.hexValue(EXPECTED_ETHEREUM_CHAIN_ID);
      }
      if (method === 'eth_sendTransaction') {
        const request = params[0];
        const raw = await USER.signTransaction({
          chainId: EXPECTED_ETHEREUM_CHAIN_ID,
          data: request.data,
          gasLimit: request.gas,
          gasPrice: 1000000000,
          nonce: await chain.nextNonce(USER.address),
          to: request.to,
          value: request.value
        });
        const hash = chain.addPending(raw);
        onSend?.(request);
        const status = mineStatus(request);
        if (status !== null) {
          chain.mine([{ raw, status }]);
        }
        return hash;
      }
      throw new Error(`Unexpected wallet call ${method}`);
    })
  };
  return provider;
};

const isApprovalRequest = (request) => request.data.startsWith('0x095ea7b3');

const setup = ({ allowance = 0, mineStatus, onSend } = {}) => {
  const chain = createScriptedChain({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, startBlock: 100 });
  chain.setAllowance(TOKEN, allowance);
  const provider = createWallet(chain, { mineStatus, onSend });
  const connector = new EventEmitter();
  syncWalletSession({
    account: USER.address,
    chainId: EXPECTED_ETHEREUM_CHAIN_ID,
    connector,
    provider,
    wallet: { name: 'MetaMask', rdns: 'io.metamask' }
  });
  const store = createSubmittedOperations({ locks: createFakeLocks(), storage: createStorage(), win: null });
  const tracker = createTransactionTracker({ pollIntervalMs: 20, siteProvider: chain.provider, store });
  return {
    chain, connector, nav: { locks: createFakeLocks() }, provider, runtime: { siteProvider: chain.provider, store, tracker }, store
  };
};

const send = (context, options = {}) => runBridgeSend({
  nav: context.nav,
  runtime: context.runtime,
  session: getWalletSession(),
  transfer: { reserveTransfer, value: '0x2386f26fc10000' },
  ...options
});

const tokenApproval = { amount: BigNumber.from(5000000), capDisplay: '5 USDC', decimals: 6, symbol: 'USDC', tokenAddress: TOKEN };
const sends = (provider) => provider.calls.filter((method) => method === 'eth_sendTransaction').length;

describe('runBridgeSend', () => {
  beforeEach(() => {
    resetWalletSessionForTests();
  });

  test('sends an ETH transfer once and tracks it to success', async () => {
    const context = setup({ mineStatus: () => 1 });
    await context.store.init();

    const result = await send(context);
    const record = await context.runtime.tracker.track(result.recordId);

    expect(sends(context.provider)).toBe(1);
    expect(record).toMatchObject({ outcome: 'success', state: 'resolved', type: 'transfer' });
  });

  test('sends the approval, waits for it, checks the allowance, then sends the transfer once', async () => {
    const onChecking = vi.fn();
    const context = setup({ allowance: 5000000, mineStatus: (request) => (isApprovalRequest(request) ? 1 : null) });
    await context.store.init();

    const result = await send(context, { approval: tokenApproval, events: { onChecking } });

    expect(sends(context.provider)).toBe(2);
    expect(onChecking).toHaveBeenCalledWith({ approvalRecordId: result.approvalRecordId });
    expect(context.store.getRecord(result.approvalRecordId)).toMatchObject({
      approvalSymbol: 'USDC', confirmedCap: '5 USDC', outcome: 'success', type: 'erc20-approval'
    });
    expect(context.store.getRecord(result.recordId)).toMatchObject({ approvalRecordId: result.approvalRecordId, type: 'transfer' });
  });

  test('stops at G5 when the approved amount is lower, and sends no transfer', async () => {
    const context = setup({ allowance: 1000, mineStatus: (request) => (isApprovalRequest(request) ? 1 : null) });
    await context.store.init();

    await expect(send(context, { approval: tokenApproval })).rejects.toBeInstanceOf(AllowanceTooLowError);
    expect(sends(context.provider)).toBe(1);
  });

  test('stops when the approval reverts, and sends no transfer', async () => {
    const context = setup({ allowance: 5000000, mineStatus: (request) => (isApprovalRequest(request) ? 0 : null) });
    await context.store.init();

    const failure = await send(context, { approval: tokenApproval }).catch((error) => error);

    expect(failure).toBeInstanceOf(ApprovalNotConfirmedError);
    expect(failure.record).toMatchObject({ outcome: 'reverted', type: 'erc20-approval' });
    expect(sends(context.provider)).toBe(1);
  });

  test('refuses to start while a record of the account is unresolved, before any prompt', async () => {
    const context = setup();
    await context.store.init();
    await send(context);

    await expect(send(context)).rejects.toThrow('A transfer from this account is not confirmed yet.');
    expect(sends(context.provider)).toBe(1);
  });

  test('two rapid sends in one tab reach the wallet once', async () => {
    const context = setup();
    await context.store.init();

    const results = await Promise.allSettled([send(context), send(context)]);

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(sends(context.provider)).toBe(1);
  });

  test('stops when the session changes while the approval confirms', async () => {
    const context = setup({
      allowance: 5000000,
      mineStatus: (request) => {
        if (isApprovalRequest(request)) {
          context.connector.emit('Web3ReactUpdate', { account: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF' });
          return 1;
        }
        return null;
      }
    });
    await context.store.init();

    const failure = await send(context, { approval: tokenApproval }).catch((error) => error);

    expect(failure).toBeInstanceOf(GuardStopError);
    expect(failure.reason).toBe('session');
    expect(sends(context.provider)).toBe(1);
  });
});
