import { Contract, providers } from 'ethers';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import { VerusdRpcInterface } from 'utils/verusdRpc';

const readVerusResult = (response, method) => {
  if (response?.error) {
    throw new Error(response.error.message || `${method} failed.`);
  }

  return response?.result ?? null;
};

const toPlainEthereumExport = (exportBatch) => ({
  endHeight: Number(exportBatch.endHeight),
  exportHash: exportBatch.exportHash,
  transfers: exportBatch.transfers.map((transfer) => ({
    amount: transfer.currencyvalue.amount.toString(),
    currency: transfer.currencyvalue.currency,
    destCurrencyId: transfer.destcurrencyid,
    destinationAddress: transfer.destination.destinationaddress,
    destinationType: Number(transfer.destination.destinationtype),
    flags: Number(transfer.flags),
    secondReserveId: transfer.secondreserveid
  }))
});

const toPlainToken = (token) => ({
  erc20address: token.erc20ContractAddress,
  flags: Number(token.flags),
  iaddress: token.iaddress,
  name: token.name,
  ticker: token.ticker
});

// Reads bridge history from the delegator contract and the Verus RPC API.
export const createBridgeActivitySources = ({
  delegatorAddress,
  ethereumChainId,
  ethereumRpcUrl,
  verusRpcUrl,
  verusSystemId
}) => {
  const provider = ethereumRpcUrl
    ? new providers.StaticJsonRpcProvider(ethereumRpcUrl, ethereumChainId)
    : null;
  const delegator = provider && delegatorAddress
    ? new Contract(delegatorAddress, DELEGATOR_ABI, provider)
    : null;
  const verusd = new VerusdRpcInterface(verusSystemId, verusRpcUrl);

  return {
    async loadEthereumActivity() {
      if (!delegator) {
        throw new Error('The Ethereum RPC URL is not configured.');
      }

      const latestBlock = await provider.getBlockNumber();
      const [exports, tokens, bestForks] = await Promise.all([
        delegator.callStatic.getReadyExportsByRange(0, latestBlock),
        delegator.callStatic.getTokenList(0, 0),
        delegator.callStatic.bestForks(0)
      ]);

      return {
        bestForks,
        exports: exports.map(toPlainEthereumExport),
        tokens: tokens.map(toPlainToken)
      };
    },

    async loadVerusActivity() {
      const [exportsResponse, notarizationResponse] = await Promise.all([
        verusd.request('getexports', [verusSystemId]),
        verusd.request('getnotarizationdata', [verusSystemId])
      ]);

      return {
        exports: readVerusResult(exportsResponse, 'getexports') || [],
        notarizationData: readVerusResult(notarizationResponse, 'getnotarizationdata')
      };
    },

    async getEthereumBlockTime(height) {
      // ethers reads a string argument as a block hash, so pass a number.
      const block = await provider?.getBlock(Number(height));
      return Number.isFinite(block?.timestamp) ? block.timestamp : null;
    },

    // The public testnet API rejects getblock calls that pass a verbosity.
    async getVerusBlockTime(heightOrHash) {
      const block = readVerusResult(await verusd.getBlock(String(heightOrHash)), 'getblock');
      return Number.isFinite(block?.time) ? block.time : null;
    },

    async getVerusCurrencyName(currencyId) {
      const currency = readVerusResult(await verusd.getCurrency(currencyId), 'getcurrency');
      return currency?.fullyqualifiedname || currency?.name || null;
    },

    async getVerusIdentityName(identityAddress) {
      const identity = readVerusResult(await verusd.getIdentity(identityAddress), 'getidentity');
      return identity?.friendlyname || identity?.fullyqualifiedname || null;
    }
  };
};
