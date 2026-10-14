// Guarded dispatch (plan G3, G4). This is the only code that calls
// eth_sendTransaction, eth_signTransaction, or eth_sendRawTransaction.
//
// Trust boundary (D17): the site controls the request up to dispatch. On path
// S it also checks a returned signed transaction before anything reaches
// Ethereum. The site cannot protect against a wallet that broadcasts on
// eth_signTransaction (Brave does this for hardware accounts, D20), falsely
// claims another wallet's rdns, or changes a transaction after the user
// confirms it on path E. Tracking (G6) never reports such an outcome as
// success, but it can leave the result unknown.
import { BigNumber, providers, utils } from 'ethers';

import { DELEGATOR_ADD, ETHEREUM_BLOCKCHAIN_NAME, EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { estimateGasLimit } from 'utils/transactions';
import { normalizeChainId } from 'utils/walletNetwork';
import { BRAVE_WALLET_RDNS, METAMASK_RDNS } from 'wallets/supportedWallets';
import { walletName, walletNameAtStart } from 'wallets/walletNames';
import { getWalletSessionId } from 'wallets/walletSession';

export const SEND_PATH_ENFORCED = 'E';
export const SEND_PATH_SIGN_AND_CHECK = 'S';

// How long the site waits for the eth_chainId answer that follows a path-S
// sign request (D20).
export const CHAIN_CHECK_TIMEOUT_MS = 10000;

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ERC20_INTERFACE = new utils.Interface(['function approve(address spender, uint256 amount)']);

// D18: the send path follows the connected wallet's rdns. Any other wallet has
// no send path.
export const getSendPath = (rdns) => {
  if (rdns === METAMASK_RDNS) {
    return SEND_PATH_ENFORCED;
  }

  if (rdns === BRAVE_WALLET_RDNS) {
    return SEND_PATH_SIGN_AND_CHECK;
  }

  return null;
};

export const SESSION_CHANGED_MESSAGE = 'Your wallet, account, or network changed. Review the transfer again.';
export const NO_SEND_PATH_MESSAGE = 'The bridge can send only with MetaMask or Brave Wallet. Connect one of them to send.';
export const INTERRUPTED_MESSAGE = "A transfer was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again.";

// A stop before dispatch. Nothing reached the wallet.
export class GuardStopError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'GuardStopError';
    this.reason = reason;
  }
}

// The wallet answered with a rejection: this request sent nothing (D23).
export class WalletRequestRejectedError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'WalletRequestRejectedError';
    this.reason = reason;
  }
}

// Path S: the site discarded a signed transaction. Nothing reached Ethereum.
export class RequestDiscardedError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'RequestDiscardedError';
    this.reason = reason;
  }
}

// The request was dispatched, and the site cannot prove that nothing was sent
// (T6). The record stays unresolved.
export class UnresolvedRequestError extends Error {
  constructor(recordId, cause) {
    super(INTERRUPTED_MESSAGE, { cause });
    this.name = 'UnresolvedRequestError';
    this.recordId = recordId;
  }
}

const readErrorCode = (error) => error?.code ?? error?.error?.code ?? error?.data?.originalError?.code;

// D23: only a rejection and an unsupported-request error prove that the
// dispatched request sent nothing. Use this for the error of the wallet
// request only, never for an RPC read, tracking, or the broadcast.
export const classifyWalletRequestError = (error) => {
  const code = readErrorCode(error);

  if (code === 4001 || code === 'ACTION_REJECTED') {
    return { kind: 'rejected', reason: 'user' };
  }

  if (code === 4200 || code === -32601) {
    return { kind: 'rejected', reason: 'unsupported' };
  }

  return { kind: 'unknown' };
};

export const getRejectionMessage = (reason, wallet) => (
  reason === 'unsupported'
    ? `${walletNameAtStart(wallet)} does not support this request. Update ${walletName(wallet)}, then try again.`
    : `Cancelled in ${walletName(wallet)}. Nothing was sent.`
);

export const getDiscardMessage = (reason, wallet) => {
  switch (reason) {
    case 'chain':
      return `${walletNameAtStart(wallet)} signed for another network. Nothing was sent. Switch ${walletName(wallet)} to ${ETHEREUM_BLOCKCHAIN_NAME}, then try again.`;
    case 'earlier':
      return 'This account has a transaction that is not confirmed yet. Nothing was sent. Wait until it confirms, then try again.';
    case 'nonce':
      return `${walletNameAtStart(wallet)} and the bridge do not agree on the next transaction number. Nothing was sent. Wait a minute, then try again.`;
    case 'held':
      return 'A transfer from this account is not confirmed yet. Wait for it, or check it again.';
    case 'latch':
      return 'Your wallet, account, or network changed. Nothing was sent. Review the transfer again.';
    default:
      return `${walletNameAtStart(wallet)} changed the transaction. Nothing was sent.`;
  }
};

export const getLatchMessage = (reason, wallet) => {
  if (reason === 'account') {
    return `The account in ${walletName(wallet)} changed while the request was open. Reject the request in ${walletName(wallet)}, then start again.`;
  }

  if (reason === 'unconfirmed') {
    return `${walletNameAtStart(wallet)} did not confirm its network while the request was open. Reject the request in ${walletName(wallet)}, then start again.`;
  }

  return `The network in ${walletName(wallet)} changed while the request was open. Reject the request in ${walletName(wallet)}, then start again.`;
};

const sameAddress = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();
const toHexQuantity = (value) => BigNumber.from(value || 0).toHexString();

// The fields that a request and a signed transaction must share.
export const toRecordRequest = (tx) => ({
  chainId: Number(tx.chainId),
  data: utils.hexlify(tx.data || '0x'),
  to: utils.getAddress(tx.to),
  value: toHexQuantity(tx.value)
});

// G6 step 2: transfers, claims, NFT sends, and ERC-721 and ERC-1155 approvals
// must match exactly. An ERC-20 approval may carry another amount, because the
// user can edit it in the wallet. G5 then decides.
export const matchesRecordRequest = ({ type, request }, observed) => {
  if (!observed?.to || Number(observed.chainId) !== Number(request.chainId) || !sameAddress(observed.to, request.to)) {
    return false;
  }

  if (!BigNumber.from(observed.value || 0).eq(BigNumber.from(request.value || 0))) {
    return false;
  }

  if (type !== 'erc20-approval') {
    return utils.hexlify(observed.data || '0x').toLowerCase() === utils.hexlify(request.data || '0x').toLowerCase();
  }

  try {
    const decoded = ERC20_INTERFACE.decodeFunctionData('approve', observed.data);
    return sameAddress(decoded.spender, DELEGATOR_ADD) && BigNumber.from(observed.value || 0).isZero();
  } catch (error) {
    return false;
  }
};

const assertSession = (sessionId) => {
  if (getWalletSessionId() !== sessionId) {
    throw new GuardStopError(SESSION_CHANGED_MESSAGE, 'session');
  }
};

const withTimeout = (promise, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
  promise.then(
    (value) => {
      clearTimeout(timer);
      resolve({ status: 'answered', value });
    },
    (error) => {
      clearTimeout(timer);
      resolve({ error, status: 'rejected' });
    }
  );
});

const parseSignedTransaction = (raw) => {
  try {
    return utils.parseTransaction(raw);
  } catch (error) {
    return null;
  }
};

// Re-broadcasts a stored raw transaction ("Check again", G6 step 5). The same
// signed transaction has the same hash and nonce, so it can execute at most
// once. The caller must have validated the raw transaction against its record.
export const rebroadcastStoredTransaction = (siteProvider, raw) => siteProvider.send('eth_sendRawTransaction', [raw]);

// Sends one approval or transaction through the connected wallet.
//
// session:   the wallet session captured when the flow started
//            ({ id, account, provider, connector, wallet: { rdns, name } }).
// contract:  an ethers Contract used only to populate the transaction.
// store:     the submitted-operations store (A5).
// events:    { onDispatch, onLatch, onHash, onDiscard, onBroadcastFailure }.
export const guardedSend = async ({
  allowBlocked = false,
  approvalRecordId,
  args = [],
  contract,
  display = {},
  events = {},
  gasLimitFloor,
  makeId = () => `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  method,
  now = () => Date.now(),
  overrides = {},
  reviewIdentity = '',
  session,
  siteProvider,
  store,
  type
}) => {
  const path = getSendPath(session?.wallet?.rdns);
  if (!path) {
    throw new GuardStopError(NO_SEND_PATH_MESSAGE, 'no-send-path');
  }

  const { account, provider, wallet } = session;

  // Step 1: populate without chainId, then add it to the result. ethers 5.8
  // rejects chainId in contract overrides (2.6). No wallet prompt happens here.
  const populated = await contract.populateTransaction[method](...args, { from: account, value: overrides.value });
  const gasLimit = await estimateGasLimit(
    () => siteProvider.estimateGas({ data: populated.data, from: account, to: populated.to, value: populated.value }),
    gasLimitFloor
  );
  const tx = {
    ...populated, chainId: EXPECTED_ETHEREUM_CHAIN_ID, from: account, gasLimit
  };

  // Step 2.
  assertSession(session.id);

  // Step 3: the live account, the live network, the bridge contract, and the
  // start block for tracking (read from the site RPC provider, D19).
  const [liveAccounts, liveChainId, bridgeCode, startBlock] = await Promise.all([
    provider.request({ method: 'eth_accounts' }),
    provider.request({ method: 'eth_chainId' }),
    siteProvider.getCode(DELEGATOR_ADD),
    siteProvider.getBlockNumber()
  ]);

  if (!Array.isArray(liveAccounts) || !sameAddress(liveAccounts[0], account)) {
    throw new GuardStopError(SESSION_CHANGED_MESSAGE, 'session');
  }

  if (normalizeChainId(liveChainId) !== EXPECTED_ETHEREUM_CHAIN_ID) {
    throw new GuardStopError(
      `Switch ${walletName(wallet)} to ${ETHEREUM_BLOCKCHAIN_NAME} before bridging assets.`,
      'wrong-network'
    );
  }

  if (!bridgeCode || /^0x0*$/i.test(bridgeCode)) {
    throw new GuardStopError(`No bridge contract is deployed at ${DELEGATOR_ADD} on ${ETHEREUM_BLOCKCHAIN_NAME}.`, 'no-contract');
  }

  // Step 4.
  assertSession(session.id);

  // Step 5.
  const hexTx = providers.JsonRpcProvider.hexlifyTransaction(tx, { from: true });
  const request = toRecordRequest(tx);

  // Step 6: under the storage lock, in one synchronous block: check the
  // session a third time, apply the send-blocking rule, write the intent, and
  // send the wallet request. The answer is awaited outside the lock.
  //
  // On path S, listen for account and network changes before the request
  // leaves, so a change while the wallet handles it is never missed (D20).
  let latchReason = null;
  let latchRecordId = null;
  let detachLatch = () => {};
  const pendingLatches = [];

  const latch = (reason) => {
    if (latchReason) {
      return;
    }

    latchReason = reason;
    if (latchRecordId) {
      events.onLatch?.({ message: getLatchMessage(reason, wallet), reason, recordId: latchRecordId });
    } else {
      pendingLatches.push(reason);
    }
  };

  if (path === SEND_PATH_SIGN_AND_CHECK && session.connector && typeof session.connector.on === 'function') {
    const handleUpdate = (update) => latch(update?.account ? 'account' : 'network');
    const handleDeactivate = () => latch('account');
    session.connector.on('Web3ReactUpdate', handleUpdate);
    session.connector.on('Web3ReactDeactivate', handleDeactivate);
    detachLatch = () => {
      session.connector.removeListener('Web3ReactUpdate', handleUpdate);
      session.connector.removeListener('Web3ReactDeactivate', handleDeactivate);
    };
  }

  let dispatched;
  try {
    dispatched = await store.runExclusive((context) => {
      assertSession(session.id);

      const record = store.writeIntentInside(context, {
        account,
        approvalRecordId,
        chainId: EXPECTED_ETHEREUM_CHAIN_ID,
        display: { ...display, walletName: walletName(wallet) },
        id: makeId(),
        path,
        request,
        reviewIdentity,
        startBlock,
        startedAt: now(),
        type
      }, { allowBlocked });

      const requestPromise = provider.request({
        method: path === SEND_PATH_ENFORCED ? 'eth_sendTransaction' : 'eth_signTransaction',
        params: [hexTx]
      });

      // D20: directly after the sign request, in the same synchronous block, ask
      // for the network. Brave handles one page's requests in order.
      const chainCheckPromise = path === SEND_PATH_SIGN_AND_CHECK
        ? provider.request({ method: 'eth_chainId' })
        : null;

      return { chainCheckPromise, record, requestPromise };
    });
  } catch (error) {
    detachLatch();
    throw error;
  }

  const { record } = dispatched;
  events.onDispatch?.({ recordId: record.id, type });
  latchRecordId = record.id;
  if (pendingLatches.length > 0) {
    events.onLatch?.({ message: getLatchMessage(latchReason, wallet), reason: latchReason, recordId: record.id });
  }

  const resolveRejected = async (reason) => {
    await store.transition(record.id, {
      from: ['awaiting-wallet'],
      patch: { outcome: 'rejected', outcomeReason: reason },
      to: 'resolved'
    });
    throw new WalletRequestRejectedError(getRejectionMessage(reason, wallet), reason);
  };

  const recordHash = async (hash, from) => {
    const hashAt = now();
    // If this write fails, the earlier record stays, and the caller keeps the
    // hash in memory and on screen (G6).
    await store.transition(record.id, { from, patch: { hash, hashAt }, to: 'submitted' }).catch(() => null);
    events.onHash?.({ hash, hashAt, recordId: record.id });
  };

  try {
    if (path === SEND_PATH_ENFORCED) {
      let hash;
      try {
        hash = await dispatched.requestPromise;
      } catch (error) {
        const classified = classifyWalletRequestError(error);
        if (classified.kind === 'rejected') {
          return await resolveRejected(classified.reason);
        }
        throw new UnresolvedRequestError(record.id, error);
      }

      if (!HASH_PATTERN.test(String(hash || ''))) {
        throw new UnresolvedRequestError(record.id);
      }

      await recordHash(hash, ['awaiting-wallet']);
      return { hash, path, recordId: record.id };
    }

    // Path S. The site processes the sign result only after the eth_chainId
    // answer arrives or its timeout ends.
    const chainCheck = withTimeout(dispatched.chainCheckPromise, CHAIN_CHECK_TIMEOUT_MS).then((result) => {
      if (result.status !== 'answered') {
        latch('unconfirmed');
      } else if (normalizeChainId(result.value) === null) {
        latch('unconfirmed');
      } else if (normalizeChainId(result.value) !== EXPECTED_ETHEREUM_CHAIN_ID) {
        latch('network');
      }
    });

    let signResult;
    try {
      signResult = await dispatched.requestPromise;
    } catch (error) {
      await chainCheck;
      const classified = classifyWalletRequestError(error);
      if (classified.kind === 'rejected') {
        return await resolveRejected(classified.reason);
      }
      throw new UnresolvedRequestError(record.id, error);
    }

    await chainCheck;

    // G4 step 1: a 32-byte hash means the wallet broadcast the transaction
    // itself (a Brave hardware account). Track it, and broadcast nothing.
    if (HASH_PATTERN.test(String(signResult || ''))) {
      await recordHash(signResult, ['awaiting-wallet']);
      return {
        hash: signResult, latched: Boolean(latchReason), path, recordId: record.id
      };
    }

    const parsed = typeof signResult === 'string' ? parseSignedTransaction(signResult) : null;
    if (!parsed) {
      throw new UnresolvedRequestError(record.id);
    }

    const discard = async (reason) => {
      await store.transition(record.id, {
        from: ['awaiting-wallet'],
        patch: { outcome: 'discarded', outcomeReason: reason },
        to: 'resolved'
      });
      const message = getDiscardMessage(reason, wallet);
      events.onDiscard?.({ message, reason, recordId: record.id });
      throw new RequestDiscardedError(message, reason);
    };

    // A latched operation never broadcasts a returned raw transaction.
    if (latchReason) {
      return await discard('latch');
    }

    // G4 step 2.
    if (Number(parsed.chainId) !== EXPECTED_ETHEREUM_CHAIN_ID) {
      return await discard('chain');
    }

    if (!sameAddress(parsed.from, account) || !matchesRecordRequest({ request, type }, parsed)) {
      return await discard('fields');
    }

    const [latestCount, pendingCount] = await Promise.all([
      siteProvider.getTransactionCount(account, 'latest'),
      siteProvider.getTransactionCount(account, 'pending')
    ]);

    if (pendingCount > latestCount) {
      return await discard('earlier');
    }

    if (parsed.nonce !== latestCount || parsed.nonce !== pendingCount) {
      return await discard('nonce');
    }

    const nonceHeld = store.getSnapshot().records.some((entry) => (
      entry.id !== record.id
      && entry.state !== 'resolved'
      && sameAddress(entry.account, account)
      && entry.chainId === EXPECTED_ETHEREUM_CHAIN_ID
      && entry.nonce === parsed.nonce
    ));
    if (nonceHeld) {
      return await discard('held');
    }

    // G4 step 4.
    if (getWalletSessionId() !== session.id) {
      latch('network');
      return await discard('latch');
    }

    const hash = utils.keccak256(signResult);
    const signed = await store.transition(record.id, {
      from: ['awaiting-wallet'],
      patch: {
        from: utils.getAddress(parsed.from), hash, hashAt: now(), nonce: parsed.nonce, raw: signResult
      },
      to: 'signed'
    });

    if (!signed) {
      throw new GuardStopError(
        'This browser does not let the site save data, so the bridge cannot protect you from sending twice. Allow site data for this site, then try again.',
        'storage'
      );
    }

    events.onHash?.({ hash, hashAt: signed.hashAt, recordId: record.id });

    // G4 steps 5 and 6: broadcast through the site RPC provider. A broadcast
    // error does not prove that nothing was sent, so the record stays open.
    try {
      const broadcastHash = await rebroadcastStoredTransaction(siteProvider, signResult);
      if (String(broadcastHash || '').toLowerCase() !== hash.toLowerCase()) {
        throw new Error('The network returned another transaction hash.');
      }
      await store.transition(record.id, { from: ['signed'], to: 'submitted' }).catch(() => null);
      return { hash, path, recordId: record.id };
    } catch (error) {
      events.onBroadcastFailure?.({ error, recordId: record.id });
      return {
        broadcastFailed: true, hash, path, recordId: record.id
      };
    }
  } finally {
    detachLatch();
  }
};
