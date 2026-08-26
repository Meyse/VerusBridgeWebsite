import { InjectedConnector } from '@web3-react/injected-connector';

import { EXPECTED_ETHEREUM_CHAIN_ID } from '../constants/contractAddress';

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [EXPECTED_ETHEREUM_CHAIN_ID]
});
