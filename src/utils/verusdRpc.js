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
    return '/';
  }

  return new URL('/', baseUrl).toString();
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

    try {
      const response = await fetch(getEndpoint(this.baseUrl), {
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

  estimateConversion(output) {
    return this.request('estimateconversion', [output]);
  }
}
