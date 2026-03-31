import { VerusdRpcInterface } from 'verusd-rpc-ts-client';

import { GLOBAL_IADDRESS } from 'constants/contractAddress';

const verusd = new VerusdRpcInterface(GLOBAL_IADDRESS.VRSC, process.env.REACT_APP_VERUS_RPC_URL);

export const fetchBridgeLiquiditySummary = async () => {
  const response = await verusd.getCurrency('bridge.veth');
  const bestState = response?.result?.bestcurrencystate;
  const currencyNames = response?.result?.currencynames;
  const reserveCurrencies = bestState?.reservecurrencies || [];

  if (!bestState || !currencyNames || reserveCurrencies.length === 0) {
    throw new Error('Bridge summary unavailable');
  }

  const daiKey = Object.keys(currencyNames).find((key) => currencyNames[key] === 'DAI.vETH');
  const daiCurrency = reserveCurrencies.find((currency) => currency.currencyid === daiKey);
  const reserveCount = reserveCurrencies.length;

  if (!daiCurrency) {
    throw new Error('DAI reserve unavailable');
  }

  return {
    reserveCount,
    bridgeSupply: bestState.supply,
    totalLiquidityDai: daiCurrency.reserves * reserveCount
  };
};
