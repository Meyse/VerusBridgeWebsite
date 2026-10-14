import {
  ANOTHER_TAB_MESSAGE,
  NO_TAB_LOCK_MESSAGE,
  createFakeLocks,
  getFlowLockName,
  runWithFlowLock
} from './operationLock';

const ACCOUNT = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';

describe('operation lock', () => {
  test('names the lock after the decimal chain id and the lowercase account', () => {
    expect(getFlowLockName('0xaa36a7', ACCOUNT)).toBe(`verus-bridge.flow.11155111.${ACCOUNT.toLowerCase()}`);
  });

  test('runs the flow while it holds the lock', async () => {
    const locks = createFakeLocks();

    await expect(runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: { locks } }, async () => 'sent'))
      .resolves.toBe('sent');
  });

  test('stops a second tab with the "another tab" message instead of waiting', async () => {
    const registry = new Map();
    const firstTab = { locks: createFakeLocks(registry) };
    const secondTab = { locks: createFakeLocks(registry) };
    let finishFirst;
    const first = runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: firstTab }, () => new Promise((resolve) => {
      finishFirst = resolve;
    }));
    await Promise.resolve();

    await expect(runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: secondTab }, async () => 'second'))
      .rejects.toThrow(ANOTHER_TAB_MESSAGE);

    finishFirst('first');
    await expect(first).resolves.toBe('first');
    await expect(runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: secondTab }, async () => 'later'))
      .resolves.toBe('later');
  });

  test('does not block another account', async () => {
    const registry = new Map();
    const tab = { locks: createFakeLocks(registry) };
    const pending = runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: tab }, () => new Promise(() => {}));
    await Promise.resolve();

    await expect(runWithFlowLock({
      account: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF',
      chainId: 11155111,
      nav: tab
    }, async () => 'other')).resolves.toBe('other');
    expect(pending).toBeInstanceOf(Promise);
  });

  test('disables sends without navigator.locks', async () => {
    await expect(runWithFlowLock({ account: ACCOUNT, chainId: 11155111, nav: {} }, async () => 'sent'))
      .rejects.toThrow(NO_TAB_LOCK_MESSAGE);
  });
});
