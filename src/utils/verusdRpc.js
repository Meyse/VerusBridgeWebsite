const JSON_RPC_VERSION = '1.0';

const createRpcError = (id, code, message, data) => ({
  error: {
    code,
    ...(data === undefined ? {} : { data }),
    message
  },
  id,
  result: null
});

const getEndpoint = (baseUrl) => {
  if (!baseUrl) {
    return null;
  }

  try {
    const endpoint = new URL('/', baseUrl);
    return endpoint.protocol === 'http:' || endpoint.protocol === 'https:'
      ? endpoint.toString()
      : null;
  } catch {
    return null;
  }
};

export class VerusdRpcInterface {
  constructor(chain, baseUrl) {
    this.baseUrl = baseUrl;
    this.chain = chain;
    this.currentId = 0;
  }

  async request(method, params) {
    const id = this.currentId;
    this.currentId += 1;
    const endpoint = getEndpoint(this.baseUrl);

    if (!endpoint) {
      return createRpcError(id, -32602, 'Verus RPC URL is not configured correctly.');
    }

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          id,
          jsonrpc: JSON_RPC_VERSION,
          method,
          params
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      if (!response.ok) {
        return createRpcError(id, response.status, `Network error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return createRpcError(id, -32603, error instanceof Error ? error.message : String(error));
    }
  }

  getBlock(hashOrHeight, verbosity) {
    return this.request('getblock', [hashOrHeight, verbosity].filter((value) => value != null));
  }

  getCurrency(currencyName) {
    return this.request('getcurrency', [currencyName].filter((value) => value != null));
  }

  getInfo() {
    return this.request('getinfo', []);
  }

  getIdentity(identityNameOrAddress) {
    return this.request('getidentity', [identityNameOrAddress]);
  }

  estimateConversion(output) {
    return this.request('estimateconversion', [output]);
  }
}
