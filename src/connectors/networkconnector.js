import { NetworkConnector } from '@web3-react/network-connector';

import { NAME_ID_MAPPING } from '../constants/chain';
import { TESTNET } from '../constants/contractAddress';

const defaultChainId = TESTNET ? NAME_ID_MAPPING.SEPOLIA.id : NAME_ID_MAPPING.HOMESTEAD.id;
const configuredRpcUrl = TESTNET
  ? process.env.REACT_APP_RPC_URL_SEPOLIA
  : process.env.REACT_APP_RPC_URL_MAINNET || process.env.REACT_APP_RPC_URL_HOMESTEAD;

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
