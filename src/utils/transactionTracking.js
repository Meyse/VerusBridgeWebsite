// Tracking of submitted operations (plan G6). It reads the expected chain
// through the site RPC provider (D19), never through the wallet, so a wallet on
// another network cannot change the result. A disconnect, reconnect, or reload
// does not stop it.
import { BigNumber, utils } from 'ethers';

import { matchesRecordRequest } from 'utils/guardedSend';

const ERC20_INTERFACE = new utils.Interface(['function approve(address spender, uint256 amount)']);
const TRACKABLE_STATES = ['signed', 'submitted', 'observed'];

export const DEFAULT_POLL_INTERVAL_MS = 4000;

const formatFee = (wei) => {
  const value = Number(utils.formatEther(wei));
  if (!Number.isFinite(value)) {
    return '';
  }
  return `${value.toFixed(value < 0.01 ? 6 : 4).replace(/\.?0+$/, '')} ETH`;
};

export const getFeePaid = (receipt) => {
  try {
    return formatFee(BigNumber.from(receipt.gasUsed).mul(BigNumber.from(receipt.effectiveGasPrice)));
  } catch (error) {
    return '';
  }
};

const getConfirmedCap = (record, tx) => {
  if (record.type !== 'erc20-approval' || !Number.isInteger(record.approvalDecimals)) {
    return undefined;
  }

  try {
    const { amount } = ERC20_INTERFACE.decodeFunctionData('approve', tx.data);
    const symbol = record.approvalSymbol ? ` ${record.approvalSymbol}` : '';
    return `${utils.formatUnits(amount, record.approvalDecimals).replace(/\.0$/, '')}${symbol}`;
  } catch (error) {
    return undefined;
  }
};

// Decodes a stored raw transaction again and checks it against its record
// (restore rule, G6 step 1). Returns the decoded transaction, or null.
export const validateStoredRawTransaction = (record) => {
  if (!record?.raw) {
    return null;
  }

  try {
    const parsed = utils.parseTransaction(record.raw);
    const sameHash = utils.keccak256(record.raw).toLowerCase() === String(record.hash || '').toLowerCase();
    const sameSender = String(parsed.from || '').toLowerCase() === String(record.account || '').toLowerCase();
    const sameNonce = record.nonce === undefined || record.nonce === parsed.nonce;

    if (!sameHash || !sameSender || !sameNonce || !matchesRecordRequest(record, parsed)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

const toReplaceable = (record, observed) => ({
  data: utils.hexlify(observed.data || '0x'),
  from: utils.getAddress(observed.from),
  nonce: observed.nonce,
  startBlock: record.startBlock,
  to: utils.getAddress(observed.to),
  value: BigNumber.from(observed.value || 0)
});

// Turns what the chain reports into a G6 outcome (G6 step 4).
export const classifyOutcome = ({ error, observed, receipt, record }) => {
  if (error?.code === 'TRANSACTION_REPLACED') {
    const replacement = error.replacement || {};
    const replacementReceipt = error.receipt || {};
    const base = { feePaid: getFeePaid(replacementReceipt), replacementHash: replacement.hash };

    if (error.reason === 'repriced') {
      // ethers compares a repriced transaction with the one it observed, not
      // with the review. Always compare with the record (G6 step 2).
      if (replacementReceipt.status === 1 && matchesRecordRequest(record, replacement)) {
        return { ...base, confirmedCap: getConfirmedCap(record, replacement), outcome: 'success' };
      }

      return { ...base, outcome: replacementReceipt.status === 1 ? 'confirmed-unexpected' : 'reverted' };
    }

    return { ...base, outcome: error.reason === 'cancelled' ? 'cancelled' : 'replaced' };
  }

  if (!receipt) {
    return null;
  }

  const feePaid = getFeePaid(receipt);
  if (receipt.status === 0) {
    return { feePaid, outcome: 'reverted' };
  }

  if (receipt.status === 1 && observed && matchesRecordRequest(record, observed)) {
    return { confirmedCap: getConfirmedCap(record, observed), feePaid, outcome: 'success' };
  }

  return { feePaid, outcome: 'confirmed-unexpected' };
};

// "Check again" without canMutateRecords (3.2, Actions): RPC reads only. The
// result is for the display. It changes no record and broadcasts nothing.
export const readRecordOutcome = async ({ record, siteProvider }) => {
  if (!record?.hash) {
    return null;
  }

  const [observed, receipt] = await Promise.all([
    siteProvider.getTransaction(record.hash),
    siteProvider.getTransactionReceipt(record.hash)
  ]);

  return receipt ? classifyOutcome({ observed, receipt, record }) : null;
};

// G6 step 5: for a record without a hash, transactions from the account to the
// same contract since the record's start block. A listed match never changes
// the record. The scan is short, so it does not load the RPC.
export const POSSIBLE_MATCH_BLOCK_LIMIT = 64;
const POSSIBLE_MATCH_BATCH_SIZE = 8;
const MAX_POSSIBLE_MATCHES = 3;

const sameAddress = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();

export const findPossibleMatches = async ({ maxBlocks = POSSIBLE_MATCH_BLOCK_LIMIT, record, siteProvider }) => {
  if (!Number.isInteger(record?.startBlock) || !record.request?.to) {
    return [];
  }

  const latest = await siteProvider.getBlockNumber();
  const last = Math.min(latest, record.startBlock + maxBlocks);
  const numbers = [];
  for (let number = record.startBlock; number <= last; number += 1) {
    numbers.push(number);
  }

  const matches = [];
  for (let index = 0; index < numbers.length; index += POSSIBLE_MATCH_BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const blocks = await Promise.all(numbers.slice(index, index + POSSIBLE_MATCH_BATCH_SIZE)
      .map((number) => siteProvider.getBlockWithTransactions(number).catch(() => null)));
    blocks.forEach((block) => {
      (block?.transactions || []).forEach((tx) => {
        if (sameAddress(tx.from, record.account) && sameAddress(tx.to, record.request.to)) {
          matches.push(tx.hash);
        }
      });
    });
  }

  return matches.reverse().slice(0, MAX_POSSIBLE_MATCHES);
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const createTransactionTracker = ({
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  siteProvider,
  store
}) => {
  const tracking = new Map();
  let stopped = false;

  const resolveRecord = (recordId, result) => store.transition(recordId, {
    from: TRACKABLE_STATES,
    patch: {
      ...(result.confirmedCap ? { confirmedCap: result.confirmedCap } : {}),
      ...(result.feePaid ? { feePaid: result.feePaid } : {}),
      ...(result.replacementHash ? { replacementHash: result.replacementHash } : {}),
      outcome: result.outcome
    },
    to: 'resolved'
  });

  // Finds the sender, nonce, and fields of the tracked transaction.
  const observe = async (recordId) => {
    let record = store.getRecord(recordId);

    if (record?.raw) {
      const parsed = validateStoredRawTransaction(record);
      if (parsed) {
        return { observed: parsed, record };
      }

      // A stored raw transaction that does not match its record is deleted.
      // The record stays unresolved and is tracked by hash only.
      record = await store.transition(recordId, { from: TRACKABLE_STATES, patch: { raw: undefined }, to: record.state })
        || { ...record, raw: undefined };
    }

    while (!stopped) {
      record = store.getRecord(recordId) || record;
      if (!record || record.state === 'resolved') {
        return null;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const tx = await siteProvider.getTransaction(record.hash);
        if (tx) {
          const mismatch = !matchesRecordRequest(record, tx);
          // eslint-disable-next-line no-await-in-loop
          const observedRecord = await store.transition(recordId, {
            from: ['signed', 'submitted', 'observed'],
            patch: {
              from: utils.getAddress(tx.from), mismatch, nonce: tx.nonce
            },
            to: 'observed'
          });
          return { observed: tx, record: observedRecord || { ...record, from: tx.from, mismatch, nonce: tx.nonce } };
        }

        // The RPC does not return the hash, but the record knows its nonce:
        // replacement detection still works from the nonce and startBlock.
        if (record.from && Number.isInteger(record.nonce)) {
          return {
            observed: {
              data: record.request.data, from: record.from, nonce: record.nonce, to: record.request.to, value: record.request.value
            },
            record
          };
        }
      } catch (error) {
        // A transient RPC error. Try again.
      }

      // eslint-disable-next-line no-await-in-loop
      await wait(pollIntervalMs);
    }

    return null;
  };

  const run = async (recordId) => {
    const found = await observe(recordId);
    if (!found || stopped) {
      return null;
    }

    const { observed, record } = found;

    while (!stopped) {
      try {
        // ethers checks replacements only when startBlock is set (2.6).
        // eslint-disable-next-line no-await-in-loop, no-underscore-dangle
        const receipt = await siteProvider._waitForTransaction(record.hash, 1, 0, toReplaceable(record, observed));
        const result = classifyOutcome({ observed, receipt, record: store.getRecord(recordId) || record });
        if (result) {
          // eslint-disable-next-line no-await-in-loop
          return await resolveRecord(recordId, result);
        }
      } catch (error) {
        const result = classifyOutcome({ error, observed, record });
        if (result) {
          // eslint-disable-next-line no-await-in-loop
          return await resolveRecord(recordId, result);
        }
      }

      // eslint-disable-next-line no-await-in-loop
      await wait(pollIntervalMs);
    }

    return null;
  };

  // Starts tracking one record that has a hash. A second call for the same
  // record returns the same promise.
  const track = (recordId) => {
    const record = store.getRecord(recordId);
    if (!record?.hash || !TRACKABLE_STATES.includes(record.state)) {
      return Promise.resolve(null);
    }

    if (!tracking.has(recordId)) {
      const promise = run(recordId).finally(() => tracking.delete(recordId));
      tracking.set(recordId, promise);
    }

    return tracking.get(recordId);
  };

  // Every unresolved record with a hash starts tracking at once (G6 step 1).
  const trackUnresolved = () => store.getSnapshot().records
    .filter((record) => record.hash && TRACKABLE_STATES.includes(record.state))
    .map((record) => track(record.id));

  // "Check again" (G6 step 5). With canMutateRecords, a validated stored raw
  // transaction is broadcast again; the caller holds the flow lock. Without it,
  // only RPC reads happen.
  const checkAgain = async (recordId, { canBroadcast }) => {
    const record = store.getRecord(recordId);
    if (!record?.hash) {
      return null;
    }

    if (canBroadcast && validateStoredRawTransaction(record)) {
      try {
        await siteProvider.send('eth_sendRawTransaction', [record.raw]);
      } catch (error) {
        // "already known" or "nonce too low" can mean that an earlier attempt
        // reached the network. Tracking decides.
      }
    }

    try {
      return await siteProvider.getTransactionReceipt(record.hash);
    } catch (error) {
      return null;
    }
  };

  const stop = () => {
    stopped = true;
  };

  return {
    checkAgain, stop, track, trackUnresolved
  };
};
