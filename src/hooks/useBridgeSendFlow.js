// The send flow of the bridge card (plan S2). The controller owns the review
// and the transfer inputs. This hook owns everything after Confirm: the flow
// state, the selected record, the send screen, and the screen actions. Its
// state lives in a module-level store (utils/sendScreenState), so a remount of
// the page keeps it.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { flushSync } from 'react-dom';

import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { describeSendStop, runBridgeSend } from 'utils/bridgeSendFlow';
import {
  addDocumentRecord,
  closeSendScreen,
  dismissSendRecord,
  getSendScreenState,
  isLiveSendFlow,
  selectSendRecord,
  setMemoryPatch,
  setSendNotice,
  startSendFlow,
  subscribeSendScreenState,
  updateSendFlow
} from 'utils/sendScreenState';
import { CONFIRMATION_TIMEOUT_MS, getCopyDetails, getSendScreen } from 'utils/sendScreens';
import { findPossibleMatches, readRecordOutcome } from 'utils/transactionTracking';
import { runWithFlowLock } from 'wallets/operationLock';
import { getSendRuntime, useSubmittedOperations } from 'wallets/sendRuntime';

const MINUTE_MS = 60000;

// A screen changes with time only for a record with a hash and no outcome:
// T1 becomes T3 after 240 s, and T3 counts whole minutes. The clock wakes the
// page at those moments only.
const useScreenClock = (record) => {
  const [now, setNow] = useState(() => Date.now());
  const since = record?.hash && !record.outcome ? (record.hashAt || record.startedAt || null) : null;

  useEffect(() => {
    if (!since) {
      return undefined;
    }

    const current = Date.now();
    const timeoutAt = since + CONFIRMATION_TIMEOUT_MS;
    const nextAt = current < timeoutAt
      ? timeoutAt
      : current + (MINUTE_MS - ((current - since) % MINUTE_MS));
    const timer = setTimeout(() => setNow(Date.now()), nextAt - current + 50);

    return () => clearTimeout(timer);
  }, [now, since]);

  return now;
};

const findRecord = (records, memoryPatches, recordId) => {
  const record = recordId ? records.find((entry) => entry.id === recordId) || null : null;
  return record && memoryPatches[recordId] ? { ...record, ...memoryPatches[recordId] } : record;
};

export default function useBridgeSendFlow({ enterStatus, wallet }) {
  const runtime = getSendRuntime();
  const operations = useSubmittedOperations();
  const screenState = useSyncExternalStore(subscribeSendScreenState, getSendScreenState, getSendScreenState);
  const [busyAction, setBusyAction] = useState(null);
  const {
    documentRecordIds,
    flow,
    memoryPatches,
    notice: stopNotice,
    selectedRecordId
  } = screenState;

  const selectedRecord = useMemo(
    () => findRecord(operations.records, memoryPatches, selectedRecordId),
    [memoryPatches, operations.records, selectedRecordId]
  );
  const approvalRecord = useMemo(
    () => findRecord(operations.records, memoryPatches, flow?.approvalRecordId),
    [flow?.approvalRecordId, memoryPatches, operations.records]
  );
  const approvalConfirmed = approvalRecord?.outcome === 'success';
  const isFlowLive = isLiveSendFlow(flow);
  // A restored record names the wallet that sent it. A live flow uses the
  // connected wallet, which also has the icon.
  const screenWallet = useMemo(() => (
    isFlowLive || !selectedRecord?.display?.walletName ? wallet : { name: selectedRecord.display.walletName }
  ), [isFlowLive, selectedRecord, wallet]);
  const now = useScreenClock(selectedRecord);

  const sendScreen = useMemo(() => {
    if (!selectedRecord) {
      return null;
    }

    const flowOfRecord = flow && flow.recordId === selectedRecord.id ? flow : {};
    // The store resolves a rejected or discarded request a moment before the
    // flow ends with its notice. Until then, this tab still holds the request,
    // so the wallet screen stays and the form does not flash.
    const heldRequest = flowOfRecord.liveRequestRecordId === selectedRecord.id
      && ['rejected', 'discarded'].includes(selectedRecord.outcome);
    return getSendScreen({
      approvalConfirmed,
      documentRecordIds,
      flow: { ...flowOfRecord, possibleMatches: memoryPatches[selectedRecord.id]?.possibleMatches },
      now,
      record: heldRequest
        ? { ...selectedRecord, outcome: undefined, outcomeReason: undefined, state: 'awaiting-wallet' }
        : selectedRecord,
      restoredUnresolvedIds: operations.restoredUnresolvedIds,
      wallet: screenWallet
    });
  }, [
    approvalConfirmed,
    documentRecordIds,
    flow,
    memoryPatches,
    now,
    operations.restoredUnresolvedIds,
    screenWallet,
    selectedRecord
  ]);

  // Starts a flow before the checks of Confirm run, so the button shows
  // "Checking…" and a second Confirm finds the flow busy.
  const beginSend = useCallback(({ account, chainId, walletTotal }) => (
    startSendFlow({ account, chainId, walletTotal })
  ), []);

  // Ends a flow that stopped before runSend, with an optional notice.
  const stopSend = useCallback((flowId, notice = null) => {
    updateSendFlow(flowId, { phase: 'ended' });
    if (notice) {
      setSendNotice(notice);
    }
  }, []);

  // Runs the bridge send. Returns { status: 'sent' }, { status: 'screen' }
  // when a record screen shows the stop, or { status: 'notice', notice,
  // surface } when a notice shows it.
  const runSend = useCallback(async (flowId, {
    allowSendAnyway,
    approval,
    display,
    onFirstDispatch,
    reviewIdentity,
    session,
    transfer,
    walletTotal = null
  }) => {
    updateSendFlow(flowId, { walletTotal });
    const types = {};
    let dispatched = false;
    let approvalRecordId = null;

    const events = {
      onBroadcastFailure: () => updateSendFlow(flowId, { broadcastFailed: true }),
      onChecking: ({ approvalRecordId: id }) => {
        approvalRecordId = id;
        updateSendFlow(flowId, { approvalRecordId: id, continuing: true, recordId: id });
      },
      onDispatch: ({ recordId, type }) => {
        types[recordId] = type;
        if (type === 'erc20-approval') {
          approvalRecordId = recordId;
        }
        // The record, the review, and the route change in one render.
        flushSync(() => {
          addDocumentRecord(recordId);
          updateSendFlow(flowId, {
            broadcastFailed: false,
            continuing: type === 'erc20-approval',
            latchReason: null,
            liveRequestRecordId: recordId,
            phase: 'wallet',
            recordId
          });
          if (!dispatched) {
            dispatched = true;
            onFirstDispatch?.();
          }
          enterStatus?.();
        });
      },
      onHash: ({ recordId }) => updateSendFlow(flowId, {
        liveRequestRecordId: null,
        phase: types[recordId] === 'erc20-approval' ? 'approval' : 'tracking'
      }),
      onLatch: ({ reason }) => updateSendFlow(flowId, { latchReason: reason })
    };

    try {
      const result = await runBridgeSend({
        allowSendAnyway,
        approval,
        display,
        events,
        reviewIdentity,
        runtime,
        session,
        transfer
      });
      updateSendFlow(flowId, {
        continuing: false,
        liveRequestRecordId: null,
        phase: 'tracking',
        recordId: result.recordId,
        ...(result.broadcastFailed ? { broadcastFailed: true } : {})
      });
      return { status: 'sent' };
    } catch (error) {
      const stop = describeSendStop(error);
      const stoppedAfterApproval = runtime.store.getRecord(approvalRecordId)?.outcome === 'success';

      if (stop.kind === 'screen') {
        flushSync(() => {
          updateSendFlow(flowId, {
            continuing: false,
            liveRequestRecordId: null,
            phase: 'ended',
            ...(stop.recordId ? { recordId: stop.recordId } : {})
          });
          enterStatus?.();
        });
        return { status: 'screen' };
      }

      // The caller applies the notice with endWithNotice, in the same
      // synchronous step as its review and route changes. So no render shows
      // the status step without a screen.
      return {
        notice: { ...stop.notice, approvalConfirmed: stoppedAfterApproval },
        status: 'notice',
        stoppedAfterApproval,
        surface: stop.surface
      };
    }
  }, [enterStatus, runtime]);

  const endWithNotice = useCallback((flowId, { notice, stoppedAfterApproval }) => {
    updateSendFlow(flowId, {
      continuing: false,
      liveRequestRecordId: null,
      phase: 'ended',
      stoppedAfterApproval
    });
    setSendNotice(notice);
  }, []);

  // "Check again" (3.2, Actions; G6 step 5).
  const checkAgain = useCallback(async (recordId) => {
    const { siteProvider, store, tracker } = runtime;
    const record = store.getRecord(recordId);
    if (!record || !siteProvider) {
      return;
    }

    setBusyAction('checkAgain');
    try {
      if (!record.hash) {
        const possibleMatches = await findPossibleMatches({ record, siteProvider }).catch(() => []);
        setMemoryPatch(recordId, { ...getSendScreenState().memoryPatches[recordId], possibleMatches });
        return;
      }

      if (store.getSnapshot().canMutateRecords && tracker) {
        await runWithFlowLock(
          { account: record.account, chainId: record.chainId },
          () => tracker.checkAgain(recordId, { canBroadcast: true })
        ).catch(() => null);
        tracker.track(recordId);
        return;
      }

      // Read-only: no broadcast, no storage write, no Web Lock.
      const result = await readRecordOutcome({ record, siteProvider }).catch(() => null);
      if (result) {
        setMemoryPatch(recordId, { ...result, state: 'resolved' });
      }
    } finally {
      setBusyAction(null);
    }
  }, [runtime]);

  // "Clear after checking my wallet": resolves a record without a hash as
  // user-cleared, after the inline confirmation.
  const clearRecord = useCallback(async (recordId) => {
    const { store } = runtime;
    const record = store.getRecord(recordId);
    if (!record || !store.getSnapshot().canMutateRecords) {
      return false;
    }

    setBusyAction('clearRecord');
    try {
      const cleared = await runWithFlowLock(
        { account: record.account, chainId: record.chainId },
        () => store.transition(recordId, { from: ['awaiting-wallet'], patch: { outcome: 'user-cleared' }, to: 'resolved' })
      ).catch(() => null);
      return Boolean(cleared);
    } finally {
      setBusyAction(null);
    }
  }, [runtime]);

  // "Back to bridge", or leaving the status step with the browser Back button:
  // the record stays hidden until the next load (D22).
  const dismissScreen = useCallback(() => {
    dismissSendRecord(getSendScreenState().selectedRecordId);
    closeSendScreen();
  }, []);

  const copyDetailsText = useMemo(() => (
    selectedRecord ? getCopyDetails({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, record: selectedRecord, wallet: screenWallet }) : ''
  ), [screenWallet, selectedRecord]);

  return {
    approvalConfirmed,
    beginSend,
    busyAction,
    canMutateRecords: operations.canMutateRecords,
    checkAgain,
    clearRecord,
    closeScreen: closeSendScreen,
    copyDetailsText,
    dismissScreen,
    endWithNotice,
    flow,
    isFlowLive,
    isPreparing: flow?.phase === 'preparing',
    getRecord: runtime.store.getRecord,
    isReady: operations.ready,
    onTransition: runtime.store.onTransition,
    records: operations.records,
    runSend,
    selectRecord: selectSendRecord,
    selectedRecord,
    sendScreen,
    stopNotice,
    stopSend
  };
}
