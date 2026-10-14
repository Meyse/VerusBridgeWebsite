import { ETHEREUM_BLOCKCHAIN_NAME, TESTNET } from 'constants/contractAddress';

import {
  CONFIRMATION_TIMEOUT_MS,
  getCopyDetails,
  getNotice,
  getOutcomeNotice,
  getSendScreen
} from './sendScreens';

// Expected strings come from plan section 3.2, never from the model.
const METAMASK = { name: 'MetaMask', rdns: 'io.metamask' };
const BRAVE = { name: 'Brave Wallet', rdns: 'com.brave.wallet' };
const NAMELESS = { name: '', rdns: 'io.metamask' };
const CHAIN = ETHEREUM_BLOCKCHAIN_NAME;
const HASH = `0x${'3f'.repeat(31)}1e`;
const REPLACEMENT = `0x${'81'.repeat(31)}d4`;
const NOW = 10_000_000;

const transfer = (fields = {}) => ({
  account: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
  chainId: 11155111,
  display: {
    destination: 'RDJZ59o6DA2Qwfg9kfUF5DLzvTyefBtAi7',
    feeRows: [{ label: 'Bridge fee', value: '0.0030 ETH' }],
    receive: '~46.58396199 VRSCTEST',
    send: '0.005 ETH',
    timeEstimate: '1-6 hours'
  },
  id: 'record-1',
  path: 'E',
  request: { chainId: 11155111, data: '0x', to: '0x98f58684b05E7d40719E61955015aF91eF7e77d3', value: '0x0' },
  startedAt: NOW - 1000,
  state: 'awaiting-wallet',
  type: 'transfer',
  ...fields
});

const approval = (fields = {}) => transfer({
  approvalDecimals: 6,
  approvalSymbol: 'USDC',
  display: { approvalCap: '5 USDC', spender: '0x2f1c000000000000000000000000000000009a4e' },
  type: 'erc20-approval',
  ...fields
});

const ofDocument = (record) => ({ documentRecordIds: new Set([record.id]), now: NOW, record });

describe('send screens: wallet screens', () => {
  test.each([
    [METAMASK, 'Confirm in MetaMask', 'Check the MetaMask window and confirm the transaction.', 'MetaMask not showing? Open it from your browser toolbar.', 'Total in MetaMask'],
    [BRAVE, 'Confirm in Brave Wallet', 'Check the Brave Wallet window and confirm the transaction.', 'Brave Wallet not showing? Open it from your browser toolbar.', 'Total in Brave Wallet'],
    [NAMELESS, 'Confirm in your wallet', 'Check your wallet and confirm the transaction.', 'Your wallet not showing? Open it from your browser toolbar.', 'Total in your wallet']
  ])('W1 for %j', (wallet, title, body, hint, totalLabel) => {
    const record = transfer();
    const result = getSendScreen({
      ...ofDocument(record), flow: { liveRequestRecordId: record.id, walletTotal: '0.0080 ETH' }, wallet
    });

    expect(result).toMatchObject({ hint, id: 'W1', mark: 'wallet', title });
    expect(result.body).toBe(body);
    expect(result.rows).toEqual([
      { label: 'You send', value: '0.005 ETH' },
      { label: 'Bridge fee', value: '0.0030 ETH' },
      { label: totalLabel, value: '0.0080 ETH' }
    ]);
    expect(result.primary).toBeNull();
    expect(result.quiet).toBeNull();
  });

  test('W1 as step 2 of 2 after a confirmed approval', () => {
    const record = transfer();
    const result = getSendScreen({
      ...ofDocument(record), flow: { approvalRecordId: 'approval-1', liveRequestRecordId: record.id }, wallet: METAMASK
    });

    expect(result.body).toBe('Step 2 of 2. Check the MetaMask window and confirm the transaction.');
    expect(result.steps).toEqual({ current: 2, total: 2 });
  });

  test('W2 asks to allow the token, step 1 of 2', () => {
    const record = approval();
    const result = getSendScreen({ ...ofDocument(record), flow: { liveRequestRecordId: record.id }, wallet: METAMASK });

    expect(result).toMatchObject({ body: 'Step 1 of 2. Let the bridge spend your USDC.', id: 'W2', title: 'Allow USDC' });
    expect(result.steps).toEqual({ current: 1, total: 2 });
    expect(result.rows).toEqual([
      { label: 'Spending cap', value: '5 USDC' },
      { label: 'Bridge contract', value: expect.stringMatching(/^0x2f1c.*9a4e$/) }
    ]);
  });

  test.each([
    ['network', 'Network changed', 'The network in Brave Wallet changed while the request was open. Reject the request in Brave Wallet, then start again.'],
    ['account', 'Account changed', 'The account in Brave Wallet changed while the request was open. Reject the request in Brave Wallet, then start again.'],
    ['unconfirmed', 'Network not confirmed', 'Brave Wallet did not confirm its network while the request was open. Reject the request in Brave Wallet, then start again.']
  ])('W3 for a %s latch', (latchReason, title, body) => {
    const record = transfer({ path: 'S' });
    const result = getSendScreen({ ...ofDocument(record), flow: { latchReason, liveRequestRecordId: record.id }, wallet: BRAVE });

    expect(result).toMatchObject({ body, id: 'W3', mark: 'bang', primary: null, title, tone: 'warning' });
  });

  test('C1 while the live flow checks the transfer after a confirmed approval', () => {
    const record = approval({ hash: HASH, outcome: 'success', state: 'resolved' });

    expect(getSendScreen({ ...ofDocument(record), flow: { continuing: true }, wallet: METAMASK }))
      .toMatchObject({ body: 'Step 2 of 2. Checking the transfer.', id: 'C1', mark: 'spinner', title: 'Checking…' });
  });
});

describe('send screens: results', () => {
  const submitted = (fields) => transfer({ hash: HASH, hashAt: NOW - 1000, state: 'submitted', ...fields });

  test('T1 while the receipt is pending', () => {
    const result = getSendScreen({ ...ofDocument(submitted()), wallet: METAMASK });

    expect(result).toMatchObject({ body: `Waiting for ${CHAIN}`, id: 'T1', title: 'Confirming…' });
    expect(result.rows.map((row) => row.label)).toEqual(['Arrives in', 'Destination', 'Transaction']);
    expect(result.rows[0].value).toBe('1-6 hours');
    expect(result.rows[2]).toMatchObject({ href: expect.stringContaining(`/tx/${HASH}`), value: 'View on Etherscan' });
  });

  test('T1 for an approval says step 1 of 2 and has no arrival row', () => {
    const result = getSendScreen({ ...ofDocument(approval({ hash: HASH, hashAt: NOW - 1000, state: 'submitted' })), wallet: METAMASK });

    expect(result.body).toBe(`Step 1 of 2. Waiting for ${CHAIN}`);
    expect(result.rows.map((row) => row.label)).toEqual(['Transaction']);
  });

  test('T2 says Sent only for a transfer with outcome success', () => {
    const result = getSendScreen({ ...ofDocument(submitted({ outcome: 'success', state: 'resolved' })), wallet: METAMASK });

    expect(result).toMatchObject({ body: '0.005 ETH → ~46.58396199 VRSCTEST', id: 'T2', title: 'Sent', tone: 'success' });
    expect(result.primary).toEqual({ action: 'newTransfer', label: 'New transfer' });
    expect(result.quiet).toEqual(TESTNET ? { action: 'viewActivity', label: 'View bridge activity' } : null);
  });

  test('T3 after 240 s without a receipt', () => {
    const record = submitted({ hashAt: NOW - CONFIRMATION_TIMEOUT_MS, state: 'observed' });
    const result = getSendScreen({ ...ofDocument(record), wallet: METAMASK });

    expect(result).toMatchObject({ body: 'The transfer can still go through.', id: 'T3', title: 'No confirmation yet' });
    expect(result.rows[0]).toEqual({ label: 'Waiting for', value: '4 min' });
    expect(result.primary).toEqual({ action: 'checkAgain', label: 'Check again' });
    expect(result.quiet).toEqual({ action: 'backToBridge', label: 'Back to bridge' });
  });

  test('T3 at once for a restored record, and at once for a failed path-S broadcast', () => {
    const record = submitted({ raw: '0x01', state: 'signed' });

    expect(getSendScreen({ now: NOW, record, restoredUnresolvedIds: new Set([record.id]), wallet: BRAVE }).id).toBe('T3');
    expect(getSendScreen({ ...ofDocument(record), flow: { broadcastFailed: true }, wallet: BRAVE }).id).toBe('T3');
  });

  test('X14 for a hash the RPC never returned, after the timeout', () => {
    const record = submitted({ hashAt: NOW - CONFIRMATION_TIMEOUT_MS });

    expect(getSendScreen({ ...ofDocument(record), wallet: METAMASK })).toMatchObject({
      body: "Check the network in your wallet's activity.",
      id: 'X14',
      primary: { action: 'checkAgain', label: 'Check again' },
      title: `Not on ${CHAIN} yet`
    });
  });

  test('T4 for a revert, with the fee paid', () => {
    const result = getSendScreen({
      ...ofDocument(submitted({ feePaid: '0.0021 ETH', outcome: 'reverted', state: 'resolved' })), wallet: METAMASK
    });

    expect(result).toMatchObject({ body: 'Your funds were not bridged.', id: 'T4', title: 'Transaction failed', tone: 'danger' });
    expect(result.rows[0]).toEqual({ label: 'Fee paid', value: '0.0021 ETH' });
    expect(result.primary).toEqual({ action: 'tryAgain', label: 'Try again' });
    expect(result.quiet).toEqual({ action: 'copyDetails', label: 'Copy details' });
  });

  test('T4 after a confirmed approval adds that the approval stays in place', () => {
    const result = getSendScreen({
      ...ofDocument(submitted({ outcome: 'reverted', state: 'resolved' })), approvalConfirmed: true, wallet: METAMASK
    });

    expect(result.body).toBe('Your funds were not bridged. The approval stays in place.');
  });

  test.each(['cancelled', 'replaced'])('T5 for a %s transaction, with the replacement link', (outcome) => {
    const result = getSendScreen({
      ...ofDocument(submitted({ outcome, replacementHash: REPLACEMENT, state: 'resolved' })), wallet: METAMASK
    });

    expect(result).toMatchObject({
      body: 'Your wallet replaced this transaction with a different one. Check the replacement before you send again.',
      id: 'T5',
      title: 'Transaction replaced'
    });
    expect(result.primary).toMatchObject({ href: expect.stringContaining(`/tx/${REPLACEMENT}`), label: 'View replacement' });
    expect(result.rows.map((row) => row.label)).toEqual(['Original', 'Replacement']);
  });

  test('T6 when the wallet never returned a transaction', () => {
    const record = transfer();
    const result = getSendScreen({ ...ofDocument(record), flow: { possibleMatches: [HASH] }, wallet: METAMASK });

    expect(result).toMatchObject({
      body: "A transfer was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again.",
      id: 'T6',
      title: 'No transaction received'
    });
    expect(result.quiet).toEqual({ action: 'clearRecord', label: 'Clear after checking my wallet' });
    expect(result.rows[0].label).toBe('Possible matches');
  });

  test('T7 for a restored approval that succeeded, with the confirmed cap', () => {
    const record = approval({
      confirmedCap: '7.5 USDC', hash: HASH, outcome: 'success', state: 'resolved'
    });
    const result = getSendScreen({ now: NOW, record, restoredUnresolvedIds: new Set([record.id]), wallet: METAMASK });

    expect(result).toMatchObject({
      body: 'The transfer was not sent. The approval stays in place.',
      id: 'T7',
      primary: { action: 'openReview', label: 'Review again' },
      title: 'Approval confirmed'
    });
    expect(result.rows[0]).toEqual({ label: 'Spending cap', value: '7.5 USDC' });
  });

  test.each([
    ['T3', 'The approval can still go through. The transfer was not sent.', { hashAt: NOW - CONFIRMATION_TIMEOUT_MS, state: 'observed' }],
    ['T4', 'The transfer was not sent.', { outcome: 'reverted', state: 'resolved' }],
    ['T5', 'Your wallet replaced this approval with a different transaction. Check the replacement before you send again.', { outcome: 'replaced', replacementHash: REPLACEMENT, state: 'resolved' }]
  ])('the approval variant of %s', (id, body, fields) => {
    const result = getSendScreen({ ...ofDocument(approval({ hash: HASH, hashAt: NOW - 1000, ...fields })), wallet: METAMASK });

    expect(result.id).toBe(id);
    expect(result.body).toBe(body);
  });

  test('the approval variant of T4 is titled Approval failed', () => {
    expect(getSendScreen({ ...ofDocument(approval({ hash: HASH, outcome: 'reverted', state: 'resolved' })), wallet: METAMASK }).title)
      .toBe('Approval failed');
  });

  test('the approval variant of T6', () => {
    expect(getSendScreen({ ...ofDocument(approval()), wallet: METAMASK }).body).toBe(
      "An approval was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again."
    );
  });

  test('X15 for a pending mismatch, before the normal pending screen', () => {
    const result = getSendScreen({ ...ofDocument(submitted({ mismatch: true, state: 'observed' })), wallet: METAMASK });

    expect(result).toMatchObject({
      body: 'The transaction differs from the reviewed transfer. Check its details in your wallet before you continue.',
      id: 'X15',
      title: 'Not the reviewed transfer'
    });
  });

  test('X16 for a confirmed transaction that is not the reviewed one', () => {
    expect(getSendScreen({ ...ofDocument(submitted({ outcome: 'confirmed-unexpected', state: 'resolved' })), wallet: METAMASK }))
      .toMatchObject({
        body: 'A different transaction than the one you reviewed was confirmed. Check it before you continue.',
        id: 'X16'
      });
  });
});

describe('send screens: selection rules', () => {
  test('no record and no live flow gives no screen', () => {
    expect(getSendScreen({ now: NOW, wallet: METAMASK })).toBeNull();
  });

  test('user-cleared gives no screen, whatever its origin', () => {
    const record = transfer({ outcome: 'user-cleared', state: 'resolved' });

    expect(getSendScreen({ ...ofDocument(record), restoredUnresolvedIds: new Set([record.id]), wallet: METAMASK })).toBeNull();
  });

  test('a record restored already resolved stays hidden; one restored unresolved keeps its result', () => {
    const record = transfer({ hash: HASH, outcome: 'success', state: 'resolved' });

    expect(getSendScreen({ now: NOW, record, wallet: METAMASK })).toBeNull();
    expect(getSendScreen({ now: NOW, record, restoredUnresolvedIds: new Set([record.id]), wallet: METAMASK }).id).toBe('T2');
  });

  test('a live awaiting-wallet record shows W1, and a restored one shows T6', () => {
    const record = transfer();

    expect(getSendScreen({ ...ofDocument(record), flow: { liveRequestRecordId: record.id }, wallet: METAMASK }).id).toBe('W1');
    expect(getSendScreen({ now: NOW, record, restoredUnresolvedIds: new Set([record.id]), wallet: METAMASK }).id).toBe('T6');
  });

  test('a rejected or discarded record gives a notice, not a screen', () => {
    const rejected = transfer({ outcome: 'rejected', outcomeReason: 'user', state: 'resolved' });

    expect(getSendScreen({ ...ofDocument(rejected), wallet: METAMASK })).toBeNull();
    expect(getOutcomeNotice({ record: rejected, wallet: METAMASK })).toMatchObject({
      body: 'Nothing was sent.', id: 'N1', role: 'status', title: 'Cancelled in MetaMask'
    });
    expect(getOutcomeNotice({ record: { ...rejected, outcomeReason: 'unsupported' }, wallet: BRAVE }).id).toBe('X9');
    expect(getOutcomeNotice({ record: { ...rejected, outcome: 'discarded', outcomeReason: 'held' }, wallet: BRAVE }).id).toBe('N9');
    expect(getOutcomeNotice({ record: { ...rejected, outcome: 'discarded', outcomeReason: 'latch' }, wallet: BRAVE }).id).toBe('X17');
  });

  test('an approval stopped inside a live flow shows no screen', () => {
    const record = approval({ hash: HASH, outcome: 'success', state: 'resolved' });

    expect(getSendScreen({ ...ofDocument(record), flow: { stoppedAfterApproval: true }, wallet: METAMASK })).toBeNull();
  });
});

describe('send screens: notices', () => {
  test.each([
    ['N3', { title: 'Brave Wallet is on another network', body: `Switch Brave Wallet to ${CHAIN} to continue.` }, `Switch to ${CHAIN}`],
    ['N6', { title: 'The bridge is paused', body: 'Sends are switched off for now. Nothing was sent.' }, 'Bridge paused'],
    ['N7', { title: 'One more signature needed', body: 'Brave Wallet signs once so the bridge can refund you if a transfer fails. It costs no gas.' }, 'Sign in Brave Wallet'],
    ['N8', { title: 'Something went wrong', body: 'Nothing was sent. Try again.' }, 'Try again'],
    ['N9', { title: 'Earlier transfer not confirmed', body: 'A transfer from this account is not confirmed yet. Wait for it, or check it again.' }, 'Check again'],
    ['X1', { title: 'Your wallet, account, or network changed', body: 'Review the transfer again.' }, 'Review again'],
    ['X2', { title: "Brave Wallet did not sign with this account's key", body: 'The bridge cannot create a refund address for this account.' }, 'Confirm'],
    ['X3', { title: 'A transfer from this account is in progress in another tab', body: 'Finish it there first.' }, 'Confirm'],
    ['X6', { title: 'The approved amount is lower than the transfer amount', body: 'Approve the full amount to continue.' }, 'Try again'],
    ['X9', { title: 'Brave Wallet does not support this request', body: 'Update Brave Wallet, then try again.' }, 'Confirm'],
    ['X10', { title: 'Brave Wallet signed for another network', body: `Nothing was sent. Switch Brave Wallet to ${CHAIN}, then try again.` }, 'Try again'],
    ['X11', { title: 'Brave Wallet changed the transaction', body: 'Nothing was sent.' }, 'Try again'],
    ['X13', { title: 'Brave Wallet and the bridge do not agree on the next transaction number', body: 'Nothing was sent. Wait a minute, then try again.' }, 'Try again'],
    ['X17', { title: 'Your wallet, account, or network changed', body: 'Nothing was sent. Review the transfer again.' }, 'Review again']
  ])('%s', (id, copy, buttonLabel) => {
    const notice = getNotice({ id, wallet: BRAVE });

    expect(notice).toMatchObject(copy);
    expect(notice.mainAction.label).toBe(buttonLabel);
    expect(notice.role).toBe('alert');
  });

  test('N4 names the amounts', () => {
    expect(getNotice({ balance: '0.0031 ETH', id: 'N4', required: '0.0080 ETH', wallet: METAMASK })).toMatchObject({
      body: 'This transfer needs 0.0080 ETH plus the network fee. Your wallet has 0.0031 ETH.',
      mainAction: { disabled: true, label: 'Not enough ETH' },
      title: 'Not enough ETH'
    });
  });

  test('N5 names the VerusID', () => {
    expect(getNotice({ id: 'N5', identityName: 'alice@', wallet: METAMASK })).toMatchObject({
      body: 'Check the new address before you continue.', title: 'alice@ now points to a new address'
    });
  });

  test('N8 keeps the error message in its details fold', () => {
    expect(getNotice({ details: 'could not detect network', id: 'N8', wallet: METAMASK }).details).toBe('could not detect network');
  });

  test('N9 offers the override only when it is allowed', () => {
    expect(getNotice({ id: 'N9', wallet: METAMASK }).quietAction).toBeNull();
    expect(getNotice({ allowSendAnyway: true, id: 'N9', wallet: METAMASK }).quietAction)
      .toEqual({ action: 'sendAnyway', label: 'Send another transfer anyway' });
  });

  test.each(['N1', 'N8', 'X10', 'X11', 'X17'])('%s after a confirmed approval never says nothing was sent', (id) => {
    const notice = getNotice({ approvalConfirmed: true, id, wallet: METAMASK });

    expect(`${notice.title} ${notice.body}`).not.toContain('Nothing was sent.');
    expect(notice.body).toContain('The transfer was not sent. The approval stays in place.');
  });

  test('X6 after a confirmed approval adds that the approval stays in place', () => {
    expect(getNotice({ approvalConfirmed: true, id: 'X6', wallet: METAMASK }).body)
      .toBe('Approve the full amount to continue. The approval stays in place.');
  });
});

describe('copy details', () => {
  test('lists the wallet, network, transaction, outcome, and time, but no account', () => {
    const text = getCopyDetails({
      chainId: 11155111,
      record: transfer({ hash: HASH, outcome: 'reverted', resolvedAt: Date.UTC(2026, 9, 14, 12, 0, 0), state: 'resolved' }),
      wallet: METAMASK
    });

    expect(text).toBe([
      'Wallet: MetaMask',
      `Network: ${CHAIN} (11155111)`,
      `Transaction: ${HASH}`,
      'Outcome: reverted',
      'Time: 2026-10-14T12:00:00.000Z'
    ].join('\n'));
    expect(text).not.toContain('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
  });
});
