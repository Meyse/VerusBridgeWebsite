describe('networkConnector', () => {
  const originalEnv = process.env;

  const loadConnectorModule = ({
    mainnetUrl,
    sepoliaUrl = 'https://sepolia.example',
    testnet = false,
    homesteadUrl
  } = {}) => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      REACT_APP_RPC_URL_MAINNET: mainnetUrl,
      REACT_APP_RPC_URL_HOMESTEAD: homesteadUrl,
      REACT_APP_RPC_URL_SEPOLIA: sepoliaUrl
    };

    const NetworkConnector = jest.fn().mockImplementation((config) => ({ config }));

    jest.doMock('@web3-react/network-connector', () => ({
      NetworkConnector
    }));

    jest.doMock('../constants/chain', () => ({
      NAME_ID_MAPPING: {
        HOMESTEAD: { id: 1 },
        SEPOLIA: { id: 11155111 }
      }
    }));

    jest.doMock('../constants/contractAddress', () => ({
      TESTNET: testnet
    }));

    let exportedModule;

    jest.isolateModules(() => {
      // Jest isolates the mocked module graph for each environment permutation.
      // eslint-disable-next-line global-require
      exportedModule = require('./networkconnector');
    });

    return {
      NetworkConnector,
      networkConnector: exportedModule.networkConnector
    };
  };

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('accepts the legacy homestead env var for mainnet fallback RPC', () => {
    const { NetworkConnector, networkConnector } = loadConnectorModule({
      homesteadUrl: 'https://mainnet-legacy.example'
    });

    expect(NetworkConnector).toHaveBeenCalledWith({
      defaultChainId: 1,
      urls: {
        1: 'https://mainnet-legacy.example',
        11155111: 'https://sepolia.example'
      }
    });
    expect(networkConnector.config.urls[1]).toBe('https://mainnet-legacy.example');
  });

  test('prefers the explicit mainnet env var when both names are present', () => {
    const { networkConnector } = loadConnectorModule({
      homesteadUrl: 'https://mainnet-legacy.example',
      mainnetUrl: 'https://mainnet-current.example'
    });

    expect(networkConnector.config.urls[1]).toBe('https://mainnet-current.example');
  });
});
