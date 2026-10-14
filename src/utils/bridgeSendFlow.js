// The bridge send flow (plan S2 with A2 to A5). It has no React in it. The
// controller prepares the transfer as before, and this flow sends it: under the
// flow lock, after the send-blocking rule, with an optional ERC-20 approval,
// the G5 allowance check, and the transfer, each through guardedSend.
import { BigNumber, Contract } from 'ethers';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC20_ABI from 'abis/ERC20Abi.json';
import { DELEGATOR_ADD } from 'constants/contractAddress';
import {
  GuardStopError,
  RequestDiscardedError,
  UnresolvedRequestError,
  WalletRequestRejectedError,
  guardedSend
} from 'utils/guardedSend';
import { MESSAGES } from 'utils/sendScreens';
import { OperationLockError, runWithFlowLock } from 'wallets/operationLock';
import { SendBlockedError, StorageUnavailableError } from 'wallets/submittedOperations';
import { getWalletSessionId } from 'wallets/walletSession';

// The old fixed limits stay as floors (see utils/transactions).
export const TRANSFER_GAS_FLOOR = 1000000;
export const APPROVAL_GAS_FLOOR = 100000;

// G5: the approved amount is lower than the transfer amount.
export class AllowanceTooLowError extends Error {
  constructor() {
    super('The approved amount is lower than the transfer amount. Approve the full amount to continue.');
    this.name = 'AllowanceTooLowError';
  }
}

// The approval did not end in success. Its record shows the result.
export class ApprovalNotConfirmedError extends Error {
  constructor(record) {
    super('The approval was not confirmed.');
    this.name = 'ApprovalNotConfirmedError';
    this.record = record;
  }
}

// A latched operation tracks a returned hash, but the flow does not continue
// to the transfer (G4, D20).
export class FlowStoppedError extends Error {
  constructor(recordId) {
    super(MESSAGES.sessionChanged);
    this.name = 'FlowStoppedError';
    this.recordId = recordId;
  }
}

const assertSession = (session) => {
  if (getWalletSessionId() !== session.id) {
    throw new GuardStopError(MESSAGES.sessionChanged, 'session');
  }
};

// approval: { tokenAddress, amount, decimals, symbol, capDisplay } or null.
// transfer: { reserveTransfer, value }.
// events: the guardedSend events, plus onChecking({ approvalRecordId }).
export const runBridgeSend = ({
  allowSendAnyway = false,
  approval = null,
  display = {},
  events = {},
  nav,
  reviewIdentity = '',
  runtime,
  session,
  transfer
}) => runWithFlowLock({ account: session.account, chainId: session.chainId, nav }, async () => {
  const { siteProvider, store, tracker } = runtime;

  if (!siteProvider || !tracker) {
    throw new GuardStopError(MESSAGES.siteRpcMissing, 'configuration');
  }

  // The send-blocking rule applies before any wallet prompt, also before an
  // approval (G6). guardedSend checks it again inside the storage lock.
  const blocking = store.findBlockingRecord({ account: session.account, chainId: session.chainId });
  if (blocking && !allowSendAnyway) {
    throw new SendBlockedError(blocking);
  }

  let approvalRecordId;

  if (approval) {
    const approvalResult = await guardedSend({
      allowBlocked: allowSendAnyway,
      args: [DELEGATOR_ADD, approval.amount],
      contract: new Contract(approval.tokenAddress, ERC20_ABI),
      display: { approvalCap: approval.capDisplay, spender: DELEGATOR_ADD },
      events,
      gasLimitFloor: APPROVAL_GAS_FLOOR,
      method: 'approve',
      recordFields: { approvalDecimals: approval.decimals, approvalSymbol: approval.symbol },
      reviewIdentity,
      session,
      siteProvider,
      store,
      type: 'erc20-approval'
    });
    approvalRecordId = approvalResult.recordId;

    if (approvalResult.latched) {
      throw new FlowStoppedError(approvalRecordId);
    }

    // Wait for the approval's tracked outcome. Only a success continues.
    const resolved = (await tracker.track(approvalRecordId)) || store.getRecord(approvalRecordId);
    if (resolved?.outcome !== 'success') {
      throw new ApprovalNotConfirmedError(resolved);
    }

    events.onChecking?.({ approvalRecordId });

    // G5: read the allowance back through the site's own provider.
    const allowance = await new Contract(approval.tokenAddress, ERC20_ABI, siteProvider)
      .allowance(session.account, DELEGATOR_ADD);
    if (BigNumber.from(allowance).lt(BigNumber.from(approval.amount))) {
      throw new AllowanceTooLowError();
    }

    // G3: check the session again after each wait.
    assertSession(session);
  }

  const transferResult = await guardedSend({
    allowBlocked: allowSendAnyway,
    approvalRecordId,
    args: [transfer.reserveTransfer],
    contract: new Contract(DELEGATOR_ADD, DELEGATOR_ABI),
    display,
    events,
    gasLimitFloor: TRANSFER_GAS_FLOOR,
    method: 'sendTransfer',
    overrides: { value: transfer.value },
    reviewIdentity,
    session,
    siteProvider,
    store,
    type: 'transfer'
  });

  return { ...transferResult, approvalRecordId };
});

const DISCARD_NOTICE_IDS = {
  chain: 'X10', earlier: 'X12', fields: 'X11', held: 'N9', latch: 'X17', nonce: 'X13'
};
const GUARD_NOTICE_IDS = {
  configuration: 'X18', 'no-send-path': 'X8', session: 'X1', storage: 'X5', 'wrong-network': 'N3'
};
// The notices that close the review and show on the form (3.2, notice
// lifecycle). Every other notice shows on Review.
const FORM_NOTICE_IDS = ['N3', 'X1', 'X17'];

const noticeStop = (id, details) => ({
  kind: 'notice',
  notice: { details: details || null, id },
  surface: FORM_NOTICE_IDS.includes(id) ? 'form' : 'review'
});

// What the bridge card shows after runBridgeSend stops (3.2, rule 3, D23).
// A stop that proves nothing was sent is a notice. Any other stop shows the
// screen of its record.
export const describeSendStop = (error) => {
  if (error instanceof WalletRequestRejectedError) {
    return noticeStop(error.reason === 'unsupported' ? 'X9' : 'N1');
  }

  if (error instanceof RequestDiscardedError) {
    return noticeStop(DISCARD_NOTICE_IDS[error.reason] || 'X11');
  }

  if (error instanceof UnresolvedRequestError) {
    return { kind: 'screen', recordId: error.recordId };
  }

  if (error instanceof ApprovalNotConfirmedError) {
    return { kind: 'screen', recordId: error.record?.id || null };
  }

  if (error instanceof FlowStoppedError) {
    return { kind: 'screen', recordId: error.recordId };
  }

  if (error instanceof AllowanceTooLowError) {
    return noticeStop('X6');
  }

  if (error instanceof SendBlockedError) {
    return noticeStop('N9');
  }

  if (error instanceof StorageUnavailableError) {
    return noticeStop('X5');
  }

  if (error instanceof OperationLockError) {
    return noticeStop(error.reason === 'held' ? 'X3' : 'X4');
  }

  if (error instanceof GuardStopError && GUARD_NOTICE_IDS[error.reason]) {
    return noticeStop(GUARD_NOTICE_IDS[error.reason]);
  }

  // A failed check or read before dispatch (N8). The message shows only in the
  // "Details" fold.
  return noticeStop('N8', error?.message || String(error));
};
