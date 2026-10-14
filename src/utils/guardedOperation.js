// Claim and NFT sends (plan A2 to A5). They take the same guards as a bridge
// send: the flow lock, the send-blocking rule, guardedSend, and tracking. The
// result shows in the alert area of that flow (3.1), not on the send screens.
import { Contract } from 'ethers';

import { getEthereumTransactionUrl } from 'config/explorerLinks';
import {
  GuardStopError,
  RequestDiscardedError,
  UnresolvedRequestError,
  WalletRequestRejectedError,
  guardedSend
} from 'utils/guardedSend';
import { CONFIRMATION_TIMEOUT_MS, MESSAGES } from 'utils/sendScreens';
import { OperationLockError, runWithFlowLock } from 'wallets/operationLock';
import { SendBlockedError, StorageUnavailableError } from 'wallets/submittedOperations';
import { getWalletSessionId } from 'wallets/walletSession';

// A tracked step ended without success. Its record shows the outcome.
export class OperationOutcomeError extends Error {
  constructor(record) {
    super('The transaction did not succeed.');
    this.name = 'OperationOutcomeError';
    this.record = record;
  }
}

// Runs the steps in order, under the flow lock. Each step is
// { abi, address, args, gasLimitFloor, method, overrides, type, afterSuccess }.
// `afterSuccess(record)` runs after the step succeeded, for example the
// NFT approval check (A4). `onPending({ hash })` reports each hash, and
// `onSlow({ hash })` reports a step that has no outcome after 240 s.
export const runGuardedOperation = ({
  nav,
  onPending,
  onSlow,
  runtime,
  session,
  steps
}) => runWithFlowLock({ account: session.account, chainId: session.chainId, nav }, async () => {
  const { siteProvider, store, tracker } = runtime;

  if (!siteProvider || !tracker) {
    throw new GuardStopError(MESSAGES.siteRpcMissing, 'configuration');
  }

  const blocking = store.findBlockingRecord({ account: session.account, chainId: session.chainId });
  if (blocking) {
    throw new SendBlockedError(blocking);
  }

  let record = null;

  // eslint-disable-next-line no-restricted-syntax
  for (const [index, step] of steps.entries()) {
    if (getWalletSessionId() !== session.id) {
      throw new GuardStopError(MESSAGES.sessionChanged, 'session');
    }

    let slowTimer = null;
    // eslint-disable-next-line no-await-in-loop
    const result = await guardedSend({
      args: step.args,
      contract: new Contract(step.address, step.abi),
      events: {
        onHash: ({ hash }) => {
          onPending?.({ hash });
          slowTimer = setTimeout(() => onSlow?.({ hash }), CONFIRMATION_TIMEOUT_MS);
        }
      },
      gasLimitFloor: step.gasLimitFloor,
      method: step.method,
      overrides: step.overrides,
      session,
      siteProvider,
      store,
      type: step.type
    });

    try {
      // eslint-disable-next-line no-await-in-loop
      record = (await tracker.track(result.recordId)) || store.getRecord(result.recordId);
    } finally {
      clearTimeout(slowTimer);
    }

    if (record?.outcome !== 'success') {
      throw new OperationOutcomeError(record);
    }

    // A latched step tracks its hash, but the flow does not continue (D20).
    if (result.latched && index < steps.length - 1) {
      throw new GuardStopError(MESSAGES.sessionChanged, 'session');
    }

    // eslint-disable-next-line no-await-in-loop
    await step.afterSuccess?.(record);
  }

  return record;
});

const linkOf = (record) => getEthereumTransactionUrl(record?.replacementHash || record?.hash);

// The alert for a stop or a failed outcome (3.1). `failureMessage` is the
// flow's own text for a reverted transaction.
export const describeOperationError = (error, { failureMessage }) => {
  if (error instanceof WalletRequestRejectedError) {
    return { message: error.message, severity: 'info' };
  }

  if (error instanceof OperationOutcomeError) {
    const { record } = error;
    switch (record?.outcome) {
      case 'reverted':
        return { href: linkOf(record), message: failureMessage, severity: 'error' };
      case 'cancelled':
      case 'replaced':
        return { href: linkOf(record), message: MESSAGES.replaced, severity: 'warning' };
      case 'confirmed-unexpected':
        return { href: linkOf(record), message: MESSAGES.confirmedUnexpected, severity: 'warning' };
      default:
        return { href: linkOf(record), message: MESSAGES.notConfirmed, severity: 'warning' };
    }
  }

  if (error instanceof UnresolvedRequestError) {
    return { message: MESSAGES.interrupted, severity: 'warning' };
  }

  if (
    error instanceof RequestDiscardedError
    || error instanceof GuardStopError
    || error instanceof SendBlockedError
    || error instanceof OperationLockError
    || error instanceof StorageUnavailableError
  ) {
    return { message: error.message, severity: 'warning' };
  }

  return { message: error?.message || failureMessage, severity: 'error' };
};
