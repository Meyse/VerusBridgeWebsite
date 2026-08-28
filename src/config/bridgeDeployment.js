export const TESTNET_DELEGATOR_ADDRESS = '0xCaA98A4eC79dAC8A06Cb3BfDcF5351b6576d939f';
export const TESTNET_VERUS_RPC_URL = 'https://api.verustest.net';

const SUPPORTED_ENVIRONMENTS = new Set(['mainnet', 'testnet']);

export const createBridgeDeployment = (environment, configuration = {}) => {
  if (!SUPPORTED_ENVIRONMENTS.has(environment)) {
    throw new Error(`Unsupported bridge environment: ${environment || 'not configured'}.`);
  }

  const isTestnet = environment === 'testnet';

  return Object.freeze({
    delegatorAddress: isTestnet
      ? TESTNET_DELEGATOR_ADDRESS
      : configuration.REACT_APP_DELEGATOR_CONTRACT,
    environment,
    ethereumBlockchainName: isTestnet ? 'Sepolia' : 'Ethereum',
    ethereumChainId: isTestnet ? 11155111 : 1,
    ethereumRpcUrl: isTestnet
      ? configuration.REACT_APP_RPC_URL_SEPOLIA
      : configuration.REACT_APP_RPC_URL_MAINNET || configuration.REACT_APP_RPC_URL_HOMESTEAD,
    isTestnet,
    verusBlockchainName: isTestnet ? 'VRSCTEST' : 'VRSC',
    verusRpcUrl: isTestnet
      ? TESTNET_VERUS_RPC_URL
      : configuration.REACT_APP_VERUS_RPC_URL
  });
};

export const BRIDGE_DEPLOYMENT = createBridgeDeployment(
  process.env.REACT_APP_BRIDGE_ENV,
  process.env
);
