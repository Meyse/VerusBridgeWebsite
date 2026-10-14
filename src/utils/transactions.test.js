import { BigNumber } from 'ethers';

import { assertTransactionSucceeded, estimateGasLimit } from './transactions';

describe('estimateGasLimit', () => {
  test('adds a 30% margin to the estimate', async () => {
    // Worked example: Sepolia estimated 1,898,412 gas for sendTransfer after the
    // repricing at block 11856337. 1,898,412 x 1.3 = 2,467,935.6, rounded down.
    const gasLimit = await estimateGasLimit(() => Promise.resolve(BigNumber.from(1898412)), 1000000);

    expect(gasLimit.toString()).toBe('2467935');
  });

  test('never goes below the old fixed limit', async () => {
    const gasLimit = await estimateGasLimit(() => Promise.resolve(BigNumber.from(500000)), 1000000);

    expect(gasLimit.toString()).toBe('1000000');
  });

  test('stops with a plain message when the estimate fails, so nothing is sent', async () => {
    const failingEstimate = () => Promise.reject(Object.assign(new Error('cannot estimate gas; transaction may fail'), {
      reason: 'execution reverted: Bridge is paused'
    }));

    await expect(estimateGasLimit(failingEstimate, 100000)).rejects.toThrow(
      'The network fee could not be estimated, so nothing was sent. The transaction would probably fail (execution reverted: Bridge is paused).'
    );
  });

  test('leaves out the reason when the wallet gives none', async () => {
    await expect(estimateGasLimit(() => Promise.reject(new Error('network error')), 100000)).rejects.toThrow(
      'The network fee could not be estimated, so nothing was sent. The transaction would probably fail.'
    );
  });
});

describe('assertTransactionSucceeded', () => {
  test('returns a successful receipt', () => {
    const receipt = { status: 1, transactionHash: '0xabc' };

    expect(assertTransactionSucceeded(receipt, 'failed')).toBe(receipt);
  });

  test('throws the given message for a reverted receipt', () => {
    expect(() => assertTransactionSucceeded({ status: 0 }, 'The transaction failed on Sepolia.')).toThrow(
      'The transaction failed on Sepolia.'
    );
  });

  test('throws when there is no receipt', () => {
    expect(() => assertTransactionSucceeded(null, 'No receipt.')).toThrow('No receipt.');
  });
});
