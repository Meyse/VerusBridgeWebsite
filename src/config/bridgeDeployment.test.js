import { createBridgeDeployment } from './bridgeDeployment';

describe('bridge deployment profile', () => {
  const configuration = {
    REACT_APP_DELEGATOR_CONTRACT: '0x0000000000000000000000000000000000000001',
    REACT_APP_MAINNET_SITE_URL: 'https://mainnet.example/',
    REACT_APP_RPC_URL_MAINNET: 'https://mainnet.example',
    REACT_APP_RPC_URL_SEPOLIA: 'https://sepolia.example',
    REACT_APP_VERUS_RPC_URL: 'https://mainnet-verus.example'
  };

  test.each([
    ['testnet', '0xCaA98A4eC79dAC8A06Cb3BfDcF5351b6576d939f', 'https://api.verustest.net', 'https://testex.verus.io'],
    // testex.verus.io indexes the public VRSCTEST chain, not ptest.
    ['ptest', '0x98f58684b05E7d40719E61955015aF91eF7e77d3', 'https://ptestapi.verustest.net', '']
  ])('pins the complete %s deployment to Sepolia and VRSCTEST', (
    environment,
    delegatorAddress,
    verusRpcUrl,
    verusExplorerUrl
  ) => {
    const deployment = createBridgeDeployment(environment, configuration);

    expect(deployment).toEqual({
      alternateSiteUrl: 'https://mainnet.example',
      delegatorAddress,
      environment,
      ethereumBlockchainName: 'Sepolia',
      ethereumChainId: 11155111,
      ethereumRpcUrl: 'https://sepolia.example',
      isTestnet: true,
      verusBlockchainName: 'VRSCTEST',
      verusExplorerUrl,
      verusRpcUrl
    });
    expect(Object.isFrozen(deployment)).toBe(true);
  });

  test('preserves the environment-driven mainnet deployment', () => {
    const deployment = createBridgeDeployment('mainnet', {
      REACT_APP_DELEGATOR_CONTRACT: '0x0000000000000000000000000000000000000002',
      REACT_APP_RPC_URL_HOMESTEAD: 'https://legacy-mainnet.example',
      REACT_APP_RPC_URL_MAINNET: 'https://mainnet.example',
      REACT_APP_RPC_URL_SEPOLIA: 'https://sepolia.example',
      REACT_APP_TESTNET_SITE_URL: 'https://testnet.example/',
      REACT_APP_VERUS_RPC_URL: 'https://verus.example'
    });

    expect(deployment).toEqual({
      alternateSiteUrl: 'https://testnet.example',
      delegatorAddress: '0x0000000000000000000000000000000000000002',
      environment: 'mainnet',
      ethereumBlockchainName: 'Ethereum',
      ethereumChainId: 1,
      ethereumRpcUrl: 'https://mainnet.example',
      isTestnet: false,
      verusBlockchainName: 'VRSC',
      verusExplorerUrl: 'https://insight.verus.io',
      verusRpcUrl: 'https://verus.example'
    });
  });

  test('rejects an unspecified or unknown deployment environment', () => {
    expect(() => createBridgeDeployment('')).toThrow(/not configured/);
    expect(() => createBridgeDeployment('staging')).toThrow(/staging/);
  });

  test('rejects a counterpart URL that is not an HTTP origin', () => {
    expect(() => createBridgeDeployment('mainnet', {
      REACT_APP_TESTNET_SITE_URL: 'https://testnet.example/bridge'
    })).toThrow(/REACT_APP_TESTNET_SITE_URL/);
    expect(() => createBridgeDeployment('testnet', {
      REACT_APP_MAINNET_SITE_URL: 'javascript:alert(1)'
    })).toThrow(/REACT_APP_MAINNET_SITE_URL/);
  });
});
