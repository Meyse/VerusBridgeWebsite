// The state of the send screens that must outlive the bridge page (plan S4).
// It has no React in it. A route change or a remount of the page keeps it.
// Only a new document load resets it.
//
// - flow: the live send flow of this document, or the last one.
// - notice: the notice of the last stop that sent nothing.
// - selectedRecordId: the record that the status screen shows.
// - documentRecordIds: the records that this document dispatched.
// - dismissed: records that the user left with "Back to bridge" or Back.
// - reopened: the once-per-load reopen ran (D22).
// - memoryPatches: results that a read-only "Check again" found, shown in
//   memory only (canMutateRecords is false).

const createInitialState = () => ({
  dismissed: new Set(),
  documentRecordIds: new Set(),
  flow: null,
  memoryPatches: {},
  notice: null,
  reopened: false,
  selectedRecordId: null
});

let state = createInitialState();
const listeners = new Set();
let nextFlowId = 1;

const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const getSendScreenState = () => state;

export const subscribeSendScreenState = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Starts a new flow. A new flow replaces the notice and the selection.
export const startSendFlow = ({ account, chainId, walletTotal = null }) => {
  const flow = {
    account,
    approvalRecordId: null,
    broadcastFailed: false,
    chainId,
    continuing: false,
    id: nextFlowId,
    latchReason: null,
    liveRequestRecordId: null,
    phase: 'preparing',
    recordId: null,
    stoppedAfterApproval: false,
    walletTotal
  };
  nextFlowId += 1;
  setState({ flow, notice: null, selectedRecordId: null });
  return flow.id;
};

// Changes the flow only while it is still the current flow, so a late event
// of an older flow changes nothing.
export const updateSendFlow = (flowId, patch) => {
  if (!state.flow || state.flow.id !== flowId) {
    return false;
  }

  const flow = { ...state.flow, ...patch };
  setState({
    flow,
    selectedRecordId: flow.recordId || state.selectedRecordId
  });
  return true;
};

export const isCurrentSendFlow = (flowId) => Boolean(state.flow && state.flow.id === flowId);

export const addDocumentRecord = (recordId) => {
  if (!recordId || state.documentRecordIds.has(recordId)) {
    return;
  }

  setState({ documentRecordIds: new Set([...state.documentRecordIds, recordId]) });
};

export const setSendNotice = (notice) => {
  setState({ notice });
};

export const clearSendNotice = () => {
  if (state.notice) {
    setState({ notice: null });
  }
};

// Selects a record without a live flow (a restored record, D22).
export const selectSendRecord = (recordId) => {
  setState({ flow: null, selectedRecordId: recordId });
};

// Phases in which the flow still acts: it can still ask the wallet.
export const LIVE_FLOW_PHASES = Object.freeze(['preparing', 'wallet', 'approval']);

export const isLiveSendFlow = (flow) => Boolean(flow && LIVE_FLOW_PHASES.includes(flow.phase));

// Closes the screen. The record stays as it is; only the selection ends. A
// live flow continues, and its next step selects its record again.
export const closeSendScreen = () => {
  setState({
    flow: isLiveSendFlow(state.flow) ? state.flow : null,
    selectedRecordId: null
  });
};

export const dismissSendRecord = (recordId) => {
  if (!recordId || state.dismissed.has(recordId)) {
    return;
  }

  setState({ dismissed: new Set([...state.dismissed, recordId]) });
};

export const isSendRecordDismissed = (recordId) => state.dismissed.has(recordId);

export const hasReopenedThisLoad = () => state.reopened;

export const markReopenedThisLoad = () => {
  if (!state.reopened) {
    setState({ reopened: true });
  }
};

export const setMemoryPatch = (recordId, patch) => {
  setState({ memoryPatches: { ...state.memoryPatches, [recordId]: patch } });
};

export const resetSendScreenStateForTests = () => {
  state = createInitialState();
  nextFlowId = 1;
  listeners.clear();
};
