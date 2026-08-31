import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';

import { injectedConnector } from './injectedConnector';

describe('injected wallet connector', () => {
  test('accepts only the chain selected for this build', () => {
    expect(injectedConnector.supportedChainIds).toEqual([EXPECTED_ETHEREUM_CHAIN_ID]);
  });
});
