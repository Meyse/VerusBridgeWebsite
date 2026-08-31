import { VerusdRpcInterface } from './verusdRpc';

describe('Verus JSON-RPC client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('preserves the request method, params, ID sequence, and configured endpoint path', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ error: null, id: 0, result: { longestchain: 10 } }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ error: null, id: 1, result: { currencyid: 'i-address' } }),
        ok: true,
        status: 200
      });
    const client = new VerusdRpcInterface('VRSC', 'https://rpc.example/verus/bridge');

    await client.getInfo();
    await client.getCurrency('bridge.veth');

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://rpc.example/verus/bridge', {
      body: JSON.stringify({ id: 0, jsonrpc: '1.0', method: 'getinfo', params: [] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://rpc.example/verus/bridge', {
      body: JSON.stringify({ id: 1, jsonrpc: '1.0', method: 'getcurrency', params: ['bridge.veth'] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
  });

  test('preserves getblock and estimateconversion parameter serialization', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: null, id: 0, result: {} }),
      ok: true,
      status: 200
    });
    const client = new VerusdRpcInterface('VRSC', 'https://rpc.example');
    const conversion = { amount: '1.25', convertto: 'i-destination', currency: 'i-source' };

    await client.getBlock('100', 1);
    await client.estimateConversion(conversion);
    await client.getIdentity('Max@');

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      method: 'getblock',
      params: ['100', 1]
    });
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toMatchObject({
      method: 'estimateconversion',
      params: [conversion]
    });
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toMatchObject({
      method: 'getidentity',
      params: ['Max@']
    });
  });

  test('returns structured errors for HTTP and network failures', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockRejectedValueOnce(new Error('offline'));
    const client = new VerusdRpcInterface('VRSC', 'https://rpc.example');

    await expect(client.getInfo()).resolves.toEqual({
      error: { code: 503, message: 'Network error 503' },
      id: 0,
      result: null
    });
    await expect(client.getInfo()).resolves.toEqual({
      error: { code: -32603, message: 'offline' },
      id: 1,
      result: null
    });
  });

  test('fails without making a request when the RPC URL is missing or invalid', async () => {
    global.fetch = vi.fn();

    await expect(new VerusdRpcInterface('VRSC', '').getInfo()).resolves.toEqual({
      error: { code: -32602, message: 'Verus RPC URL is not configured correctly.' },
      id: 0,
      result: null
    });
    await expect(new VerusdRpcInterface('VRSC', 'file:///tmp/rpc').getInfo()).resolves.toEqual({
      error: { code: -32602, message: 'Verus RPC URL is not configured correctly.' },
      id: 0,
      result: null
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
