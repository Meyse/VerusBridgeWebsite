// The bridge send flow (plan S2 with A2 to A5). It has no React in it. The
// controller prepares the transfer as before, and this flow sends it: under the
// flow lock, after the send-blocking rule, with an optional ERC-20 approval,
// the G5 allowance check, and the transfer, each through guardedSend.
import { BigNumber, Contract } from 'ethers';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC20_ABI from 'abis/ERC20Abi.json';
import { DELEGATOR_ADD } from 'constants/contractAddress';
import { GuardStopError, guardedSend } from 'utils/guardedSend';
import { MESSAGES } from 'utils/sendScreens';
import { runWithFlowLock } from 'wallets/operationLock';
import { SendBlockedError } from 'wallets/submittedOperations';
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
