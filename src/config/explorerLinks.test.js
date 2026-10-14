import { TESTNET } from 'constants/contractAddress';

import { getEthereumTransactionUrl } from './explorerLinks';

const EXPLORER = TESTNET ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';

describe('getEthereumTransactionUrl', () => {
  test('links a valid hash on the build explorer', () => {
    const hash = `0x${'ab'.repeat(32)}`;

    expect(getEthereumTransactionUrl(hash)).toBe(`${EXPLORER}/tx/${hash}`);
  });

  test.each([undefined, '', '0x1234', `0x${'zz'.repeat(32)}`, `${'ab'.repeat(32)}`])('gives no link for %j', (hash) => {
    expect(getEthereumTransactionUrl(hash)).toBeNull();
  });
});
