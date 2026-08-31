import {
  TESTNET_DELEGATOR_ADDRESS,
  TESTNET_VERUS_RPC_URL,
  createBridgeDeployment
} from './bridgeDeployment';

describe('bridge deployment profile', () => {
  test('pins the complete testnet deployment to Sepolia and VRSCTEST', () => {
    const deployment = createBridgeDeployment('testnet', {
      REACT_APP_DELEGATOR_CONTRACT: '0x0000000000000000000000000000000000000001',
      REACT_APP_MAINNET_SITE_URL: 'https://mainnet.example/',
      REACT_APP_RPC_URL_MAINNET: 'https://mainnet.example',
      REACT_APP_RPC_URL_SEPOLIA: 'https://sepolia.example',
      REACT_APP_VERUS_RPC_URL: 'https://mainnet-verus.example'
    });

    expect(deployment).toEqual({
      alternateSiteUrl: 'https://mainnet.example',
      delegatorAddress: TESTNET_DELEGATOR_ADDRESS,
      environment: 'testnet',
      ethereumBlockchainName: 'Sepolia',
      ethereumChainId: 11155111,
      ethereumRpcUrl: 'https://sepolia.example',
      isTestnet: true,
      verusBlockchainName: 'VRSCTEST',
      verusRpcUrl: TESTNET_VERUS_RPC_URL
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
