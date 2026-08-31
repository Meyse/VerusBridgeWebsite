import { act, renderHook, waitFor } from '@testing-library/react';

import { useVerusDestinationResolution } from './useVerusDestinationResolution';

const MAX_ID_ADDRESS = 'iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX';

describe('useVerusDestinationResolution', () => {
  test('resolves an identity and exposes a user-facing confirmation', async () => {
    const rpc = {
      getIdentity: vi.fn().mockResolvedValue({
        result: {
          fullyqualifiedname: 'Max.VRSC@',
          identity: { identityaddress: MAX_ID_ADDRESS },
          status: 'active'
        }
      })
    };

    const { result } = renderHook(() => (
      useVerusDestinationResolution('Max@', rpc, 'VRSC', 0)
    ));

    expect(result.current.isResolving).toBe(true);

    await waitFor(() => {
      expect(result.current.address).toBe(MAX_ID_ADDRESS);
    });

    expect(result.current).toMatchObject({
      error: '',
      identityName: 'Max.VRSC@',
      isIdentity: true,
      isResolving: false,
      message: `Max.VRSC@ resolves to ${MAX_ID_ADDRESS}.`
    });
  });

  test('ignores an obsolete response after the input changes', async () => {
    let finishFirstRequest;
    const rpc = {
      getIdentity: vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          finishFirstRequest = resolve;
        }))
        .mockResolvedValueOnce({
          result: {
            fullyqualifiedname: 'Alice.VRSC@',
            identity: { identityaddress: MAX_ID_ADDRESS },
            status: 'active'
          }
        })
    };
    const { result, rerender } = renderHook(
      ({ value }) => useVerusDestinationResolution(value, rpc, 'VRSC', 0),
      { initialProps: { value: 'Max@' } }
    );

    await waitFor(() => expect(rpc.getIdentity).toHaveBeenCalledWith('Max@'));
    rerender({ value: 'Alice@' });

    await waitFor(() => expect(result.current.identityName).toBe('Alice.VRSC@'));

    await act(async () => {
      finishFirstRequest({
        result: {
          fullyqualifiedname: 'Max.VRSC@',
          identity: { identityaddress: MAX_ID_ADDRESS },
          status: 'active'
        }
      });
    });

    expect(result.current.identityName).toBe('Alice.VRSC@');
  });

  test('passes a regular address through synchronously', () => {
    const rpc = { getIdentity: vi.fn() };
    const { result } = renderHook(() => (
      useVerusDestinationResolution(MAX_ID_ADDRESS, rpc, 'VRSC', 0)
    ));

    expect(result.current).toMatchObject({
      address: MAX_ID_ADDRESS,
      error: '',
      identityName: '',
      isIdentity: false,
      isResolving: false,
      message: ''
    });
    expect(rpc.getIdentity).not.toHaveBeenCalled();
  });
});
