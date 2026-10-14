// The operation lock (plan G3). A transfer, claim, or NFT send holds a Web Lock
// named after the chain and the account for its whole flow, so a second tab
// cannot send from the same account at the same time.

export const ANOTHER_TAB_MESSAGE = 'A transfer from this account is in progress in another tab. Finish it there first.';
export const NO_TAB_LOCK_MESSAGE = 'This browser cannot stop two tabs from sending at once, so the bridge cannot send. Update your browser, then try again.';

export class OperationLockError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'OperationLockError';
    this.reason = reason;
  }
}

const getNavigator = () => (typeof navigator === 'undefined' ? undefined : navigator);

export const canLockAcrossTabs = (nav = getNavigator()) => typeof nav?.locks?.request === 'function';

export const getFlowLockName = (chainId, account) => (
  `verus-bridge.flow.${Number(chainId)}.${String(account || '').toLowerCase()}`
);

// Runs callback while this tab holds the flow lock. It never waits for another
// tab: a held lock stops the flow with the "another tab" message.
export const runWithFlowLock = ({ account, chainId, nav = getNavigator() }, callback) => {
  if (!canLockAcrossTabs(nav)) {
    return Promise.reject(new OperationLockError(NO_TAB_LOCK_MESSAGE, 'unsupported'));
  }

  return nav.locks.request(getFlowLockName(chainId, account), { ifAvailable: true }, (lock) => {
    if (!lock) {
      throw new OperationLockError(ANOTHER_TAB_MESSAGE, 'held');
    }

    return callback();
  });
};

// A minimal in-memory Web Locks implementation for tests. Two instances that
// share `registry` behave like two tabs of one browser.
export const createFakeLocks = (registry = new Map()) => ({
  registry,
  request: async (name, options, callback) => {
    const run = typeof options === 'function' ? options : callback;
    const ifAvailable = typeof options === 'object' && options?.ifAvailable;

    if (registry.has(name)) {
      if (ifAvailable) {
        return run(null);
      }

      await registry.get(name);
    }

    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    registry.set(name, held);

    try {
      return await run({ name });
    } finally {
      registry.delete(name);
      release();
    }
  }
});
