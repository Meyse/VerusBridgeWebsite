import { BigNumber } from 'ethers';

export const GAS_LIMIT_MARGIN_PERCENT = 30;

// Sepolia repriced new storage writes at block 11856337 (2026-10-06). After
// that, the bridge calls needed far more gas than the old fixed limits, and the
// transactions ran out of gas. Estimate each call, add a margin, and keep the
// old fixed limit as a floor, so that no call gets less gas than before.
export const estimateGasLimit = async (estimateCall, floor) => {
  let estimate;

  try {
    estimate = BigNumber.from(await estimateCall());
  } catch (error) {
    const reason = typeof error?.reason === 'string' && error.reason ? ` (${error.reason})` : '';
    throw new Error(
      `The network fee could not be estimated, so nothing was sent. The transaction would probably fail${reason}.`,
      { cause: error }
    );
  }

  const withMargin = estimate.mul(100 + GAS_LIMIT_MARGIN_PERCENT).div(100);
  const minimum = BigNumber.from(floor);

  return withMargin.gt(minimum) ? withMargin : minimum;
};
