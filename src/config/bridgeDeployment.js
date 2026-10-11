const MAINNET_VERUS_EXPLORER_URL = 'https://insight.verus.io';

// Both testnet profiles bridge Sepolia to VRSCTEST. Only the delegator, Verus API, and explorer differ.
export const TESTNET_PROFILES = Object.freeze({
  // The public VRSCTEST bridge.
  testnet: Object.freeze({
    delegatorAddress: '0xCaA98A4eC79dAC8A06Cb3BfDcF5351b6576d939f',
    verusExplorerUrl: 'https://testex.verus.io',
    verusRpcUrl: 'https://api.verustest.net'
  }),
  // The separate ptest VRSCTEST chain. testex.verus.io shows the public chain, so ptest has no explorer links.
  ptest: Object.freeze({
    delegatorAddress: '0x98f58684b05E7d40719E61955015aF91eF7e77d3',
    verusExplorerUrl: '',
    verusRpcUrl: 'https://ptestapi.verustest.net'
  })
});

const SUPPORTED_ENVIRONMENTS = new Set(['mainnet', ...Object.keys(TESTNET_PROFILES)]);

const resolveOptionalSiteOrigin = (configurationKey, configuredUrl) => {
  if (!configuredUrl) {
    return '';
  }

  let siteUrl;
  try {
    siteUrl = new URL(configuredUrl);
  } catch {
    throw new Error(`${configurationKey} must be an HTTP origin.`);
  }

  const isHttpOrigin = ['http:', 'https:'].includes(siteUrl.protocol)
    && siteUrl.pathname === '/'
    && !siteUrl.search
    && !siteUrl.hash
    && !siteUrl.username
    && !siteUrl.password;
  if (!isHttpOrigin) {
    throw new Error(`${configurationKey} must be an HTTP origin.`);
  }

  return siteUrl.origin;
};

export const createBridgeDeployment = (environment, configuration = {}) => {
  if (!SUPPORTED_ENVIRONMENTS.has(environment)) {
    throw new Error(`Unsupported bridge environment: ${environment || 'not configured'}.`);
  }

  const testnetProfile = TESTNET_PROFILES[environment];
  const isTestnet = Boolean(testnetProfile);
  const alternateSiteConfigurationKey = isTestnet
    ? 'REACT_APP_MAINNET_SITE_URL'
    : 'REACT_APP_TESTNET_SITE_URL';

  return Object.freeze({
    alternateSiteUrl: resolveOptionalSiteOrigin(
      alternateSiteConfigurationKey,
      configuration[alternateSiteConfigurationKey]
    ),
    delegatorAddress: isTestnet
      ? testnetProfile.delegatorAddress
      : configuration.REACT_APP_DELEGATOR_CONTRACT,
    environment,
    ethereumBlockchainName: isTestnet ? 'Sepolia' : 'Ethereum',
    ethereumChainId: isTestnet ? 11155111 : 1,
    ethereumRpcUrl: isTestnet
      ? configuration.REACT_APP_RPC_URL_SEPOLIA
      : configuration.REACT_APP_RPC_URL_MAINNET || configuration.REACT_APP_RPC_URL_HOMESTEAD,
    isTestnet,
    verusBlockchainName: isTestnet ? 'VRSCTEST' : 'VRSC',
    verusExplorerUrl: isTestnet ? testnetProfile.verusExplorerUrl : MAINNET_VERUS_EXPLORER_URL,
    verusRpcUrl: isTestnet
      ? testnetProfile.verusRpcUrl
      : configuration.REACT_APP_VERUS_RPC_URL
  });
};

export const BRIDGE_DEPLOYMENT = createBridgeDeployment(
  process.env.REACT_APP_BRIDGE_ENV,
  process.env
);
