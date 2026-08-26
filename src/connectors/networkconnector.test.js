describe('networkConnector', () => {
  const originalEnv = process.env;

  const loadConnectorModule = async ({
    mainnetUrl,
    sepoliaUrl = 'https://sepolia.example',
    testnet = false,
    homesteadUrl
  } = {}) => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      REACT_APP_RPC_URL_MAINNET: mainnetUrl,
      REACT_APP_RPC_URL_HOMESTEAD: homesteadUrl,
      REACT_APP_RPC_URL_SEPOLIA: sepoliaUrl
    };

    const NetworkConnector = vi.fn(function MockNetworkConnector(config) {
      this.config = config;
    });

    vi.doMock('@web3-react/network-connector', () => ({
      NetworkConnector
    }));

    vi.doMock('../constants/chain', () => ({
      NAME_ID_MAPPING: {
        HOMESTEAD: { id: 1 },
        SEPOLIA: { id: 11155111 }
      }
    }));

    vi.doMock('../constants/contractAddress', () => ({
      TESTNET: testnet
    }));

    const exportedModule = await import('./networkconnector');

    return {
      NetworkConnector,
      networkConnector: exportedModule.networkConnector
    };
  };

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('accepts the legacy homestead env var for mainnet fallback RPC', async () => {
    const { NetworkConnector, networkConnector } = await loadConnectorModule({
      homesteadUrl: 'https://mainnet-legacy.example'
    });

    expect(NetworkConnector).toHaveBeenCalledWith({
      defaultChainId: 1,
      urls: {
        1: 'https://mainnet-legacy.example'
      }
    });
    expect(networkConnector.config.urls[1]).toBe('https://mainnet-legacy.example');
  });

  test('prefers the explicit mainnet env var when both names are present', async () => {
    const { networkConnector } = await loadConnectorModule({
      homesteadUrl: 'https://mainnet-legacy.example',
      mainnetUrl: 'https://mainnet-current.example'
    });

    expect(networkConnector.config.urls[1]).toBe('https://mainnet-current.example');
  });

  test('configures only Sepolia for a testnet build', async () => {
    const { networkConnector } = await loadConnectorModule({
      mainnetUrl: 'https://mainnet.example',
      sepoliaUrl: 'https://sepolia.example',
      testnet: true
    });

    expect(networkConnector.config).toEqual({
      defaultChainId: 11155111,
      urls: { 11155111: 'https://sepolia.example' }
    });
  });

  test('does not construct a connector from a missing or invalid selected URL', async () => {
    const { NetworkConnector, networkConnector } = await loadConnectorModule({
      mainnetUrl: 'not a URL',
      sepoliaUrl: undefined
    });

    expect(networkConnector).toBeNull();
    expect(NetworkConnector).not.toHaveBeenCalled();
  });
});
