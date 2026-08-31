import { NetworkConnector } from '@web3-react/network-connector';

import { BRIDGE_DEPLOYMENT } from '../config/bridgeDeployment';

const defaultChainId = BRIDGE_DEPLOYMENT.ethereumChainId;
const configuredRpcUrl = BRIDGE_DEPLOYMENT.ethereumRpcUrl;

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const networkConnector = isHttpUrl(configuredRpcUrl)
  ? new NetworkConnector({
    defaultChainId,
    urls: { [defaultChainId]: configuredRpcUrl }
  })
  : null;
