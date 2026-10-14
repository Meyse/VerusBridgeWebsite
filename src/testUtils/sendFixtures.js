// Test fixtures for sends at the wallet boundary (plan 8.1a, 8.8): a fake
// MetaMask that signs with real ethers and hands the transaction to a scripted
// chain, and a send runtime on that chain with in-memory Web Locks.
import { EventEmitter } from 'events';

import { utils } from 'ethers';

import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { createFakeLocks } from 'wallets/operationLock';
import { createSendRuntime, setSendRuntimeForTests } from 'wallets/sendRuntime';
import { createSubmittedOperations } from 'wallets/submittedOperations';
import { syncWalletSession } from 'wallets/walletSession';

export const METAMASK_WALLET = Object.freeze({ name: 'MetaMask', rdns: 'io.metamask' });

const APPROVE_SELECTOR = '0x095ea7b3';

export const isApprovalRequest = (request) => String(request?.data || '').startsWith(APPROVE_SELECTOR);

// A MetaMask-like EIP-1193 provider (path E). `mineStatus(request)` returns
// null to leave the transaction pending, or the receipt status to mine it at
// once. `reject(request)` returns an error to reject the request with.
// `beforeSend(request)` can hold the answer until the test releases it.
// `chainId` is the network that the wallet reports.
export const createSigningMetaMask = ({
  beforeSend = async () => {},
  chain,
  chainId = EXPECTED_ETHEREUM_CHAIN_ID,
  mineStatus = () => null,
  reject = () => null,
  signer
}) => {
  const calls = [];
  const sentRequests = [];

  const provider = {
    calls,
    on: () => {},
    removeListener: () => {},
    request: async ({ method, params }) => {
      calls.push(method);

      if (method === 'eth_accounts') {
        return [signer.address];
      }

      if (method === 'eth_chainId') {
        return utils.hexValue(chainId);
      }

      if (method === 'eth_sendTransaction') {
        const request = params[0];
        sentRequests.push(request);
        // A test can hold the wallet answer, as a user who has not decided yet.
        await beforeSend(request);

        const rejection = reject(request);
        if (rejection) {
          throw rejection;
        }

        const raw = await signer.signTransaction({
          chainId: EXPECTED_ETHEREUM_CHAIN_ID,
          data: request.data,
          gasLimit: request.gas,
          gasPrice: 1000000000,
          nonce: await chain.nextNonce(signer.address),
          to: request.to,
          value: request.value
        });
        const hash = chain.addPending(raw);
        const status = mineStatus(request);
        if (status !== null) {
          chain.mine([{ raw, status }]);
        }

        return hash;
      }

      throw new Error(`The fake wallet does not answer ${method}`);
    },
    sentRequests
  };

  return provider;
};

// Pins a connected wallet session, as WalletProvider does after a connect.
export const connectTestWallet = ({ provider, signer, wallet = METAMASK_WALLET }) => {
  const connector = new EventEmitter();
  syncWalletSession({
    account: signer.address,
    chainId: EXPECTED_ETHEREUM_CHAIN_ID,
    connector,
    provider,
    wallet
  });
  return connector;
};

// The send runtime on a scripted chain, with in-memory Web Locks for the
// storage lock and the flow lock. Call the returned cleanup after the test.
export const installSendRuntime = ({ chain, storage = window.localStorage } = {}) => {
  const locks = createFakeLocks();
  const previousLocks = Object.getOwnPropertyDescriptor(window.navigator, 'locks');
  Object.defineProperty(window.navigator, 'locks', { configurable: true, value: locks });

  const store = createSubmittedOperations({ locks, storage, win: null });
  const runtime = createSendRuntime({ pollIntervalMs: 20, siteProvider: chain?.provider || null, store });
  setSendRuntimeForTests(runtime);

  const cleanup = () => {
    runtime.tracker?.stop();
    setSendRuntimeForTests(null);
    if (previousLocks) {
      Object.defineProperty(window.navigator, 'locks', previousLocks);
    } else {
      delete window.navigator.locks;
    }
  };

  return { cleanup, runtime };
};
