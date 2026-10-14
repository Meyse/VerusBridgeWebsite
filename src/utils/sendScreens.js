// The send screens model (plan 3.2, step S1). It is pure: it turns the live
// flow of this document and one submitted-operation record into the screen or
// the notice that the bridge card shows. Every string of section 3.2 lives
// here, and nowhere else.
import { getEthereumTransactionUrl } from 'config/explorerLinks';
import { ETHEREUM_BLOCKCHAIN_NAME, TESTNET } from 'constants/contractAddress';
import { formatCompactAddress } from 'utils/bridgeUi';
import { FALLBACK_WALLET_NAME, walletName, walletNameAtStart } from 'wallets/walletNames';

// A hint under the wallet screens' rows, 15 s after they show.
export const WALLET_HINT_DELAY_MS = 15000;
// G6 step 6: no receipt 240 s after the hash exists.
export const CONFIRMATION_TIMEOUT_MS = 240000;
// The Activity page exists only in testnet builds.
export const BRIDGE_ACTIVITY_AVAILABLE = TESTNET;

// Messages that other modules throw. They are notices on the send screens.
export const MESSAGES = Object.freeze({
  anotherTab: 'A transfer from this account is in progress in another tab. Finish it there first.',
  approvalStaysInPlace: 'The approval stays in place.',
  interrupted: "A transfer was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again.",
  noSendPath: 'The bridge can send only with MetaMask or Brave Wallet. Connect one of them to send.',
  noTabLock: 'This browser cannot stop two tabs from sending at once, so the bridge cannot send. Update your browser, then try again.',
  sendBlocked: 'A transfer from this account is not confirmed yet. Wait for it, or check it again.',
  sessionChanged: 'Your wallet, account, or network changed. Review the transfer again.',
  siteRpcMissing: 'This site is not set up to send transactions. Nothing was sent.',
  storageUnavailable: 'This browser does not let the site save data, so the bridge cannot protect you from sending twice. Allow site data for this site, then try again.'
});

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
      return MESSAGES.sendBlocked;
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

export const getWalletEventsUnavailableMessage = (wallet) => (
  `${walletNameAtStart(wallet)} does not report account or network changes, so the bridge cannot use it.`
);

export const getWrongNetworkMessage = (wallet) => `Switch ${walletName(wallet)} to ${ETHEREUM_BLOCKCHAIN_NAME} before bridging assets.`;

// Rule 8: after a confirmed approval, a stop of the transfer never says that
// nothing was sent.
const applyApprovalHistory = (body, approvalConfirmed) => {
  if (!approvalConfirmed) {
    return body;
  }

  const replaced = body.replace('Nothing was sent.', `The transfer was not sent. ${MESSAGES.approvalStaysInPlace}`);
  return replaced === body ? `${body} ${MESSAGES.approvalStaysInPlace}`.trim() : replaced;
};

// A notice's title is its first sentence without the final period. The body is
// the rest (3.2, "Other notices").
const splitMessage = (message) => {
  const match = message.match(/^(.+?\.)(\s+(.*))?$/);
  if (!match) {
    return { body: '', title: message };
  }

  return { body: match[3] || '', title: match[1].replace(/\.$/, '') };
};

const transactionLink = (hash) => ({
  href: getEthereumTransactionUrl(hash),
  label: 'Transaction',
  value: 'View on Etherscan'
});

const compactHash = (hash) => (hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : '');

const destinationRow = (display) => (
  display.destination || display.destinationName
    ? { label: 'Destination', value: display.destinationName || formatCompactAddress(display.destination) }
    : null
);

const withoutEmpty = (rows) => rows.filter((row) => row && (row.value || row.links?.length) && (row.href !== null || row.value !== 'View on Etherscan'));

const isApproval = (record) => record?.type === 'erc20-approval';

const minutesSince = (since, now) => Math.max(1, Math.floor((now - since) / 60000));

const screen = (fields) => ({
  hint: null,
  primary: null,
  quiet: null,
  rows: [],
  steps: null,
  ...fields
});

const pendingTitle = 'Confirming…';

const confirmingScreen = (record) => {
  const display = record.display || {};

  if (isApproval(record)) {
    return screen({
      body: `Step 1 of 2. Waiting for ${ETHEREUM_BLOCKCHAIN_NAME}`,
      id: 'T1',
      mark: 'spinner',
      rows: withoutEmpty([transactionLink(record.hash)]),
      title: pendingTitle,
      tone: 'accent'
    });
  }

  return screen({
    body: `Waiting for ${ETHEREUM_BLOCKCHAIN_NAME}`,
    id: 'T1',
    mark: 'spinner',
    rows: withoutEmpty([
      display.timeEstimate ? { label: 'Arrives in', value: display.timeEstimate } : null,
      destinationRow(display),
      transactionLink(record.hash)
    ]),
    title: pendingTitle,
    tone: 'accent'
  });
};

const walletScreen = ({ flow, record, wallet }) => {
  const display = record.display || {};

  if (flow.latchReason) {
    const titles = { account: 'Account changed', network: 'Network changed', unconfirmed: 'Network not confirmed' };
    return screen({
      body: getLatchMessage(flow.latchReason, wallet),
      id: 'W3',
      mark: 'bang',
      title: titles[flow.latchReason] || titles.network,
      tone: 'warning'
    });
  }

  const hint = `${walletNameAtStart(wallet)} not showing? Open it from your browser toolbar.`;

  if (isApproval(record)) {
    return screen({
      body: `Step 1 of 2. Let the bridge spend your ${record.approvalSymbol || 'tokens'}.`,
      hint,
      id: 'W2',
      mark: 'wallet',
      rows: withoutEmpty([
        { label: 'Spending cap', value: display.approvalCap },
        display.spender ? { label: 'Bridge contract', value: formatCompactAddress(display.spender) } : null
      ]),
      steps: { current: 1, total: 2 },
      title: `Allow ${record.approvalSymbol || 'token'}`,
      tone: 'accent'
    });
  }

  const isSecondStep = Boolean(flow.approvalRecordId);
  const feeRows = (display.feeRows || []).map((row) => ({ label: row.label, value: row.value }));

  return screen({
    // Without an announced name, "Check the your wallet window" would not read
    // well, so that case has its own sentence.
    body: `${isSecondStep ? 'Step 2 of 2. ' : ''}${walletName(wallet) === FALLBACK_WALLET_NAME
      ? 'Check your wallet and confirm the transaction.'
      : `Check the ${walletName(wallet)} window and confirm the transaction.`}`,
    hint,
    id: 'W1',
    mark: 'wallet',
    rows: withoutEmpty([
      { label: 'You send', value: display.send },
      ...feeRows,
      flow.walletTotal ? { label: `Total in ${walletName(wallet)}`, value: flow.walletTotal } : null
    ]),
    steps: isSecondStep ? { current: 2, total: 2 } : null,
    title: `Confirm in ${walletName(wallet)}`,
    tone: 'accent'
  });
};

const checkingScreen = () => screen({
  body: 'Step 2 of 2. Checking the transfer.',
  id: 'C1',
  mark: 'spinner',
  title: 'Checking…',
  tone: 'accent'
});

const resultScreen = ({ approvalConfirmed, record }) => {
  const display = record.display || {};
  const approval = isApproval(record);
  const history = (body) => (approval ? body : applyApprovalHistory(body, approvalConfirmed));

  switch (record.outcome) {
    case 'success':
      if (approval) {
        return screen({
          body: `The transfer was not sent. ${MESSAGES.approvalStaysInPlace}`,
          id: 'T7',
          mark: 'bang',
          primary: { action: 'openReview', label: 'Review again' },
          quiet: { action: 'newTransfer', label: 'New transfer' },
          rows: withoutEmpty([
            { label: 'Spending cap', value: record.confirmedCap },
            transactionLink(record.replacementHash || record.hash)
          ]),
          title: 'Approval confirmed',
          tone: 'warning'
        });
      }

      return screen({
        body: display.send && display.receive ? `${display.send} → ${display.receive}` : '',
        id: 'T2',
        mark: 'check',
        primary: { action: 'newTransfer', label: 'New transfer' },
        quiet: BRIDGE_ACTIVITY_AVAILABLE ? { action: 'viewActivity', label: 'View bridge activity' } : null,
        rows: withoutEmpty([
          display.timeEstimate ? { label: 'Arrives in', value: display.timeEstimate } : null,
          destinationRow(display),
          transactionLink(record.replacementHash || record.hash)
        ]),
        title: 'Sent',
        tone: 'success'
      });
    case 'reverted':
      return screen({
        body: approval ? 'The transfer was not sent.' : history('Your funds were not bridged.'),
        id: 'T4',
        mark: 'cross',
        primary: { action: 'tryAgain', label: 'Try again' },
        quiet: { action: 'copyDetails', label: 'Copy details' },
        rows: withoutEmpty([
          { label: 'Fee paid', value: record.feePaid },
          transactionLink(record.replacementHash || record.hash)
        ]),
        title: approval ? 'Approval failed' : 'Transaction failed',
        tone: 'danger'
      });
    case 'cancelled':
    case 'replaced':
      return screen({
        body: history(approval
          ? 'Your wallet replaced this approval with a different transaction. Check the replacement before you send again.'
          : 'Your wallet replaced this transaction with a different one. Check the replacement before you send again.'),
        id: 'T5',
        mark: 'bang',
        primary: { action: 'openExplorer', href: getEthereumTransactionUrl(record.replacementHash), label: 'View replacement' },
        quiet: { action: 'newTransfer', label: 'New transfer' },
        rows: withoutEmpty([
          { label: 'Original', value: compactHash(record.hash) },
          { label: 'Replacement', value: compactHash(record.replacementHash) }
        ]),
        title: 'Transaction replaced',
        tone: 'warning'
      });
    case 'confirmed-unexpected':
      return screen({
        body: 'A different transaction than the one you reviewed was confirmed. Check it before you continue.',
        id: 'X16',
        mark: 'bang',
        primary: {
          action: 'openExplorer',
          href: getEthereumTransactionUrl(record.replacementHash || record.hash),
          label: 'View on Etherscan'
        },
        quiet: { action: 'newTransfer', label: 'New transfer' },
        rows: withoutEmpty([transactionLink(record.replacementHash || record.hash)]),
        title: 'Not the reviewed transfer',
        tone: 'warning'
      });
    default:
      return null;
  }
};

const unresolvedWithHashScreen = ({ flow, now, restored, record }) => {
  const elapsed = now - (record.hashAt || record.startedAt || now);
  const timeUp = restored || elapsed >= CONFIRMATION_TIMEOUT_MS;
  const neverObserved = !record.raw && record.state !== 'observed';
  const waitingRow = { label: 'Waiting for', value: `${minutesSince(record.hashAt || record.startedAt || now, now)} min` };

  if (flow.broadcastFailed || (timeUp && !neverObserved)) {
    return screen({
      body: isApproval(record)
        ? 'The approval can still go through. The transfer was not sent.'
        : 'The transfer can still go through.',
      id: 'T3',
      mark: 'clock',
      primary: { action: 'checkAgain', label: 'Check again' },
      quiet: { action: 'backToBridge', label: 'Back to bridge' },
      rows: withoutEmpty([waitingRow, transactionLink(record.hash)]),
      title: 'No confirmation yet',
      tone: 'warning'
    });
  }

  if (timeUp) {
    return screen({
      body: "Check the network in your wallet's activity.",
      id: 'X14',
      mark: 'clock',
      primary: { action: 'checkAgain', label: 'Check again' },
      quiet: { action: 'backToBridge', label: 'Back to bridge' },
      rows: withoutEmpty([waitingRow, transactionLink(record.hash)]),
      title: `Not on ${ETHEREUM_BLOCKCHAIN_NAME} yet`,
      tone: 'warning'
    });
  }

  return confirmingScreen(record);
};

const interruptedScreen = ({ approvalConfirmed, flow, record }) => screen({
  body: isApproval(record)
    ? "An approval was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again."
    : applyApprovalHistory(MESSAGES.interrupted, approvalConfirmed),
  id: 'T6',
  mark: 'bang',
  primary: { action: 'checkAgain', label: 'Check again' },
  quiet: { action: 'clearRecord', label: 'Clear after checking my wallet' },
  rows: (flow.possibleMatches || []).length > 0
    ? [{
      label: 'Possible matches',
      links: flow.possibleMatches.slice(0, 3).map((hash) => ({ href: getEthereumTransactionUrl(hash), label: compactHash(hash) }))
    }]
    : [],
  title: 'No transaction received',
  tone: 'warning'
});

// Picks the screen for a record (3.2, "Screen selection"). The order settles
// every conflict between the record and the live flow of this document.
//
// flow: {
//   liveRequestRecordId, latchReason, continuing, stoppedAfterApproval,
//   approvalRecordId, broadcastFailed, walletTotal, possibleMatches
// }
export const getSendScreen = ({
  approvalConfirmed = false,
  documentRecordIds = new Set(),
  flow = {},
  now = Date.now(),
  record,
  restoredUnresolvedIds = new Set(),
  wallet
}) => {
  // Rule 1.
  if (!record) {
    return flow.phase === 'checking' ? checkingScreen() : null;
  }

  const restored = restoredUnresolvedIds.has(record.id);

  // Rule 2.
  if (record.outcome === 'user-cleared') {
    return null;
  }

  if (record.state === 'resolved' && !documentRecordIds.has(record.id) && !restored) {
    return null;
  }

  // Rule 3.
  if (record.mismatch && !record.outcome) {
    return screen({
      body: 'The transaction differs from the reviewed transfer. Check its details in your wallet before you continue.',
      id: 'X15',
      mark: 'bang',
      primary: { action: 'openExplorer', href: getEthereumTransactionUrl(record.hash), label: 'View on Etherscan' },
      quiet: { action: 'backToBridge', label: 'Back to bridge' },
      rows: withoutEmpty([transactionLink(record.hash)]),
      title: 'Not the reviewed transfer',
      tone: 'warning'
    });
  }

  // Rule 5, for an approval that a live flow continues or stopped.
  if (record.outcome === 'success' && isApproval(record)) {
    if (flow.continuing) {
      return checkingScreen();
    }

    if (flow.stoppedAfterApproval) {
      return null;
    }
  }

  // Rules 4 to 6.
  if (['success', 'reverted', 'cancelled', 'replaced', 'confirmed-unexpected'].includes(record.outcome)) {
    return resultScreen({ approvalConfirmed, record });
  }

  // Rule 7: a rejection or a discard is a notice, not a screen.
  if (record.outcome === 'rejected' || record.outcome === 'discarded') {
    return null;
  }

  // Rule 8.
  if (record.state === 'awaiting-wallet') {
    if (flow.liveRequestRecordId === record.id) {
      return walletScreen({ flow, record, wallet });
    }

    return interruptedScreen({ approvalConfirmed, flow, record });
  }

  // Rule 9.
  if (record.hash) {
    return unresolvedWithHashScreen({
      flow, now, record, restored
    });
  }

  return null;
};

// The notices on Review and the form (3.2, "Notices" and "Other notices").
// The main button's label and action follow the notice lifecycle table.
const NOTICE_ACTIONS = {
  N1: { action: 'confirm', label: 'Confirm' },
  N3: { action: 'switchNetwork', label: `Switch to ${ETHEREUM_BLOCKCHAIN_NAME}` },
  N4: { action: null, disabled: true, label: 'Not enough ETH' },
  N5: { action: 'openReview', label: 'Review again' },
  N6: { action: null, disabled: true, label: 'Bridge paused' },
  N7: { action: 'signRefundKey', label: 'Sign in {wallet}' },
  N8: { action: 'tryAgain', label: 'Try again' },
  N9: { action: 'checkAgain', label: 'Check again' },
  X1: { action: 'openReview', label: 'Review again' },
  X6: { action: 'tryAgain', label: 'Try again' },
  X10: { action: 'tryAgain', label: 'Try again' },
  X11: { action: 'tryAgain', label: 'Try again' },
  X12: { action: 'tryAgain', label: 'Try again' },
  X13: { action: 'tryAgain', label: 'Try again' },
  X17: { action: 'openReview', label: 'Review again' }
};
const BLOCKING_NOTICES = ['X2', 'X3', 'X4', 'X5', 'X7', 'X8', 'X9', 'X18'];

// Notices about a changed wallet session. They end when the user reviews
// again, not when an input changes.
export const SESSION_NOTICE_IDS = Object.freeze(['N3', 'X1', 'X17']);

const DISCARD_NOTICE_IDS = {
  chain: 'X10', earlier: 'X12', fields: 'X11', held: 'N9', latch: 'X17', nonce: 'X13'
};

const noticeMainAction = (id, wallet) => {
  if (BLOCKING_NOTICES.includes(id)) {
    return { action: null, disabled: true, label: 'Confirm' };
  }

  const action = NOTICE_ACTIONS[id] || { action: 'confirm', label: 'Confirm' };
  return { ...action, label: action.label.replace('{wallet}', walletName(wallet)) };
};

const buildNotice = ({
  allowSendAnyway = false, approvalConfirmed, body, details, id, title, tone = 'warning', wallet
}) => ({
  body: applyApprovalHistory(body, approvalConfirmed),
  details: details || null,
  id,
  mainAction: noticeMainAction(id, wallet),
  // G6: the override is not offered while the record holds a raw
  // transaction (path S).
  quietAction: id === 'N9' && allowSendAnyway ? { action: 'sendAnyway', label: 'Send another transfer anyway' } : null,
  role: id === 'N1' ? 'status' : 'alert',
  title,
  tone
});

const noticeFromMessage = ({ approvalConfirmed, id, message, wallet }) => {
  const { body, title } = splitMessage(message);
  return buildNotice({
    approvalConfirmed, body, id, title, wallet
  });
};

// reason: one of the notice ids, plus the inputs that its copy needs.
export const getNotice = ({
  allowSendAnyway = false,
  approvalConfirmed = false,
  balance,
  details,
  identityName,
  id,
  required,
  wallet
}) => {
  switch (id) {
    case 'N1':
      return buildNotice({
        approvalConfirmed, body: 'Nothing was sent.', id, title: `Cancelled in ${walletName(wallet)}`, tone: 'info', wallet
      });
    case 'N3':
      return buildNotice({
        body: `Switch ${walletName(wallet)} to ${ETHEREUM_BLOCKCHAIN_NAME} to continue.`,
        id,
        title: `${walletNameAtStart(wallet)} is on another network`,
        wallet
      });
    case 'N4':
      return buildNotice({
        body: `This transfer needs ${required} plus the network fee. Your wallet has ${balance}.`, id, title: 'Not enough ETH', wallet
      });
    case 'N5':
      return buildNotice({
        body: 'Check the new address before you continue.', id, title: `${identityName} now points to a new address`, wallet
      });
    case 'N6':
      return buildNotice({
        approvalConfirmed, body: 'Sends are switched off for now. Nothing was sent.', id, title: 'The bridge is paused', wallet
      });
    case 'N7':
      return buildNotice({
        body: `${walletNameAtStart(wallet)} signs once so the bridge can refund you if a transfer fails. It costs no gas.`,
        id,
        title: 'One more signature needed',
        wallet
      });
    case 'N8':
      return buildNotice({
        approvalConfirmed, body: 'Nothing was sent. Try again.', details, id, title: 'Something went wrong', tone: 'danger', wallet
      });
    case 'N9':
      return buildNotice({
        allowSendAnyway, body: MESSAGES.sendBlocked, id, title: 'Earlier transfer not confirmed', wallet
      });
    case 'X1':
      return noticeFromMessage({ approvalConfirmed, id, message: MESSAGES.sessionChanged, wallet });
    case 'X2':
      return noticeFromMessage({
        id, message: `${walletNameAtStart(wallet)} did not sign with this account's key. The bridge cannot create a refund address for this account.`, wallet
      });
    case 'X3':
      return noticeFromMessage({ id, message: MESSAGES.anotherTab, wallet });
    case 'X4':
      return noticeFromMessage({ id, message: MESSAGES.noTabLock, wallet });
    case 'X5':
      return noticeFromMessage({ id, message: MESSAGES.storageUnavailable, wallet });
    case 'X6':
      return noticeFromMessage({
        approvalConfirmed, id, message: 'The approved amount is lower than the transfer amount. Approve the full amount to continue.', wallet
      });
    case 'X7':
      return noticeFromMessage({ id, message: getWalletEventsUnavailableMessage(wallet), wallet });
    case 'X8':
      return noticeFromMessage({ id, message: MESSAGES.noSendPath, wallet });
    case 'X9':
      return noticeFromMessage({ id, message: getRejectionMessage('unsupported', wallet), wallet });
    case 'X10':
      return noticeFromMessage({
        approvalConfirmed, id, message: getDiscardMessage('chain', wallet), wallet
      });
    case 'X11':
      return noticeFromMessage({
        approvalConfirmed, id, message: getDiscardMessage('fields', wallet), wallet
      });
    case 'X12':
      return noticeFromMessage({
        approvalConfirmed, id, message: getDiscardMessage('earlier', wallet), wallet
      });
    case 'X13':
      return noticeFromMessage({
        approvalConfirmed, id, message: getDiscardMessage('nonce', wallet), wallet
      });
    case 'X17':
      return noticeFromMessage({
        approvalConfirmed, id, message: getDiscardMessage('latch', wallet), wallet
      });
    case 'X18':
      return noticeFromMessage({ id, message: MESSAGES.siteRpcMissing, wallet });
    default:
      return null;
  }
};

// Rule 7: the notice for a record that ended without a screen.
export const getOutcomeNotice = ({ approvalConfirmed = false, record, wallet }) => {
  if (record?.outcome === 'rejected') {
    return getNotice({ approvalConfirmed, id: record.outcomeReason === 'unsupported' ? 'X9' : 'N1', wallet });
  }

  if (record?.outcome === 'discarded') {
    return getNotice({ approvalConfirmed, id: DISCARD_NOTICE_IDS[record.outcomeReason] || 'X11', wallet });
  }

  return null;
};

// D22 considers only bridge sends on the build's chain. Claim and NFT records
// never open the send screens.
export const BRIDGE_SEND_TYPES = Object.freeze(['transfer', 'erc20-approval']);

export const isBridgeSendRecord = (record, chainId) => (
  Boolean(record) && BRIDGE_SEND_TYPES.includes(record.type) && record.chainId === chainId
);

// The record that a load reopens (D22): the newest unresolved bridge send.
export const pickReopenRecord = ({ chainId, isDismissed = () => false, records }) => records
  .filter((record) => (
    isBridgeSendRecord(record, chainId) && record.state !== 'resolved' && !isDismissed(record.id)
  ))
  .sort((left, right) => right.startedAt - left.startedAt)[0] || null;

// The outcomes that have a result screen. The others end in a notice.
export const RESULT_SCREEN_OUTCOMES = Object.freeze(['success', 'reverted', 'cancelled', 'replaced', 'confirmed-unexpected']);

// The late-result decision (3.2, "Selection, route, and history"): one
// decision for each transition event of the records store. Only a result that
// has a screen, of a bridge send that nothing else shows, opens the status
// step, and only from the form.
export const shouldOpenLateResult = ({
  chainId, event, flow, isDismissed = () => false, record, step
}) => {
  if (event?.to !== 'resolved' || !isBridgeSendRecord(record, chainId)) {
    return false;
  }

  if (isDismissed(record.id) || !RESULT_SCREEN_OUTCOMES.includes(record.outcome)) {
    return false;
  }

  const ownedByLiveFlow = Boolean(flow?.isLive && (flow.recordId === record.id || flow.approvalRecordId === record.id));
  return !ownedByLiveFlow && !step;
};

// The text that "Copy details" puts on the clipboard (3.2, "Actions"). No
// account address and no key.
export const getCopyDetails = ({ chainId, record, wallet }) => [
  `Wallet: ${walletNameAtStart(wallet)}`,
  `Network: ${ETHEREUM_BLOCKCHAIN_NAME} (${chainId})`,
  `Transaction: ${record?.replacementHash || record?.hash || 'none'}`,
  `Outcome: ${record?.outcome || 'pending'}`,
  `Time: ${new Date(record?.resolvedAt || record?.hashAt || record?.startedAt || Date.now()).toISOString()}`
].join('\n');
