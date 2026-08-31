import { resolveVerusDestination } from './verusDestination';

const MAX_ID_ADDRESS = 'iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX';

describe('Verus destination resolution', () => {
  test('resolves a friendly VerusID to its canonical active i-address', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        result: {
          friendlyname: 'Max.VRSC@',
          fullyqualifiedname: 'Max.VRSC@',
          identity: {
            identityaddress: MAX_ID_ADDRESS
          },
          status: 'active'
        }
      })
    };

    await expect(resolveVerusDestination(' Max@ ', rpc, 'VRSC')).resolves.toEqual({
      address: MAX_ID_ADDRESS,
      identityName: 'Max.VRSC@',
      input: 'Max@',
      isIdentity: true
    });
    expect(rpc.getIdentity).toHaveBeenCalledWith('Max@');
  });

  test('passes regular addresses through without making an RPC request', async () => {
    const rpc = { getIdentity: vi.fn() };

    await expect(resolveVerusDestination(` ${MAX_ID_ADDRESS} `, rpc, 'VRSC')).resolves.toEqual({
      address: MAX_ID_ADDRESS,
      identityName: '',
      input: MAX_ID_ADDRESS,
      isIdentity: false
    });
    expect(rpc.getIdentity).not.toHaveBeenCalled();
  });

  test('reports a network-scoped error when the VerusID does not exist', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        error: { code: -5, message: 'Identity not found' },
        result: null
      })
    };

    await expect(resolveVerusDestination('Max@', rpc, 'VRSCTEST')).rejects.toThrow(
      'VerusID not found on VRSCTEST.'
    );
  });

  test('rejects identities that are not active', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        result: {
          identity: { identityaddress: MAX_ID_ADDRESS },
          status: 'revoked'
        }
      })
    };

    await expect(resolveVerusDestination('Max@', rpc, 'VRSC')).rejects.toThrow(
      'This VerusID is not active on VRSC.'
    );
  });

  test('rejects malformed identity addresses returned by RPC', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        result: {
          identity: { identityaddress: `${MAX_ID_ADDRESS.slice(0, -1)}Y` },
          status: 'active'
        }
      })
    };

    await expect(resolveVerusDestination('Max@', rpc, 'VRSC')).rejects.toThrow(
      'This VerusID did not resolve to a valid i-address on VRSC.'
    );
  });

  test('does not misreport RPC failures as missing identities', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        error: { code: -32603, message: 'Failed to fetch' },
        result: null
      })
    };

    await expect(resolveVerusDestination('Max@', rpc, 'VRSC')).rejects.toThrow(
      'Unable to resolve this VerusID on VRSC. Failed to fetch'
    );
  });
});
