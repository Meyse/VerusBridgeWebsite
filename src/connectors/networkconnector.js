import { NetworkConnector } from '@web3-react/network-connector';

import { NAME_ID_MAPPING } from '../constants/chain';
import { TESTNET } from '../constants/contractAddress';

const RPC_URLS = {
  [NAME_ID_MAPPING.HOMESTEAD.id]: process.env.REACT_APP_RPC_URL_MAINNET || process.env.REACT_APP_RPC_URL_HOMESTEAD || '',
  [NAME_ID_MAPPING.SEPOLIA.id]: process.env.REACT_APP_RPC_URL_SEPOLIA || ''
};

const defaultChainId = TESTNET ? NAME_ID_MAPPING.SEPOLIA.id : NAME_ID_MAPPING.HOMESTEAD.id;

export const networkConnector = new NetworkConnector({
  urls: RPC_URLS,
  defaultChainId
});
