import { useCallback, useEffect, useMemo, useState } from 'react';

import { useWeb3React } from '@web3-react/core';
import { utils } from 'ethers';
import { flushSync } from 'react-dom';
import { VerusdRpcInterface } from 'verusd-rpc-ts-client';
import web3 from 'web3';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC20_ABI from 'abis/ERC20Abi.json';
import { useToast } from 'components/Toast/ToastProvider';
import {
  BLOCKCHAIN_NAME,
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  ETH_FEES,
  GLOBAL_ADDRESS,
  GLOBAL_IADDRESS,
  HEIGHT_LOCATION_IN_FORKS
} from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import bitGoUTXO from 'utils/bitUTXO';
import {
  buildDestinationCurrency,
  buildTokenCurrency,
  formatCurrencyFiat,
  getTokenDisplaySymbol,
  sortSourceCurrencies
} from 'utils/bridgeUi';
import { getContract, getMaxAmount } from 'utils/contract';
import { HOME_BRIDGE_INTERFACE_HASH } from 'utils/homeNavigation';
import {
  getDestinationOptions,
  getTokenOptions,
  supportsOnlyDirectVerusDestination
} from 'utils/options';
import {
  REFUND_ADDRESS_STORAGE_KEY,
  requestRefundAddressData
} from 'utils/refundAddress';
import { coinsToSats, isETHAddress, uint64ToVerusFloat, validateAddress } from 'utils/rules';
import { getConfigOptions } from 'utils/txConfig';

const maxGas = 1000000;
const maxGas2 = 100000;
const BRIDGE_STATUS_POLL_INTERVAL_MS = 60_000;
const INTERNAL_PRICE_POLL_INTERVAL_MS = 60_000;
const ESTIMATED_VERUS_BLOCK_TIME_SECONDS = 60;
const FLAG_DEST_GATEWAY = 128;
const FLORALIS_CURRENCY_NAME = 'Floralis';
const NATI_CURRENCY_NAME = 'NATI🦉';
const PRICE_WARNING_THRESHOLD_PERCENT = 3;
const PRICE_SOURCE_BRIDGE = 'Bridge.vETH';
const PRICE_SOURCE_FLORALIS = 'Floralis';
const PRICE_SOURCE_PEG = 'peg';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const STATIC_USD_PRICE_BY_SYMBOL = {
  DAI: 1,
  USDC: 1,
  USDT: 1
};
const BRIDGE_WARNING_DESTINATION_SYMBOL_BY_VALUE = {
  bridgeDAI: 'DAI',
  bridgeETH: 'ETH',
  bridgeMKR: 'MKR',
  bridgeVRSC: 'VRSC',
  swaptoDAI: 'DAI',
  swaptoETH: 'ETH',
  swaptoMKR: 'MKR',
  swaptoVRSC: 'VRSC'
};
const { GAS_TRANSACTIONIMPORTFEE, MINIMUM_GAS_PRICE_WEI } = ETH_FEES;
const verusd = new VerusdRpcInterface(GLOBAL_IADDRESS.VRSC, process.env.REACT_APP_VERUS_RPC_URL);
const hasGatewayFlag = (value) => Math.floor(Number(value) / FLAG_DEST_GATEWAY) % 2 === 1;
const BALANCE_SORT_EPSILON = 0.000001;
const ETH_SOURCE_TOKEN_VALUE = GLOBAL_ADDRESS.ETH.toLowerCase();

const toFiniteNumber = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseNotarizationHeight = (forksData) => {
  if (typeof forksData !== 'string') {
    return 1;
  }

  const parsedHeight = toFiniteNumber(parseInt(`0x${forksData.substring(HEIGHT_LOCATION_IN_FORKS, HEIGHT_LOCATION_IN_FORKS + 8)}`, 16));
  return parsedHeight && parsedHeight > 1 ? parsedHeight : 1;
};

const getBlockTime = async (height) => {
  const response = await verusd.getBlock(`${height}`, 1);
  const blockInfo = response?.result;

  if (typeof blockInfo !== 'object' || blockInfo === null) {
    return null;
  }

  return toFiniteNumber(blockInfo.time);
};

const formatQuotedAmount = (value) => {
  if (!value && value !== 0) {
    return '--';
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return '--';
  }

  return parsedValue
    .toFixed(8)
    .replace(/\.?0+$/, '');
};

const formatBalance = (value) => {
  const parsedValue = parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return '--';
  }

  return Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
  }).format(parsedValue);
};

const normalizePriceSymbol = (value) => (value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

const getPriceLookupSymbol = (value) => {
  const normalizedSymbol = normalizePriceSymbol(value);

  if (['BETH', 'BRIDGE', 'VBRID', 'BRIDGEVETH'].includes(normalizedSymbol)) {
    return 'BRIDGE';
  }

  if (normalizedSymbol === 'VETH') {
    return 'ETH';
  }

  if (normalizedSymbol.endsWith('VETH')) {
    const withoutSuffix = normalizedSymbol.slice(0, -4);

    if (withoutSuffix === 'BRIDGE') {
      return 'BRIDGE';
    }

    if (withoutSuffix.startsWith('V') && withoutSuffix.length > 1) {
      return withoutSuffix.slice(1);
    }

    return withoutSuffix;
  }

  return normalizedSymbol;
};

const getAmountFiatLabel = (value, symbol, prices) => {
  const parsedAmount = parseFloat(value);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !symbol) {
    return null;
  }

  const fiatPrice = prices[getPriceLookupSymbol(symbol)];
  if (!Number.isFinite(fiatPrice)) {
    return null;
  }

  return formatCurrencyFiat(parsedAmount * fiatPrice);
};

const getCurrencyState = (currencyResult) => (
  currencyResult?.result?.bestcurrencystate
  || currencyResult?.result?.lastconfirmedcurrencystate
  || null
);

const getCurrencyNameMap = (currencyResult) => (
  typeof currencyResult?.result?.currencynames === 'object' && currencyResult.result.currencynames !== null
    ? currencyResult.result.currencynames
    : {}
);

const getReserveEntriesBySymbol = (currencyResult) => {
  const state = getCurrencyState(currencyResult);
  const currencyNames = getCurrencyNameMap(currencyResult);

  if (!Array.isArray(state?.reservecurrencies)) {
    return {};
  }

  return state.reservecurrencies.reduce((reserveMap, reserveEntry) => {
    const reserveName = currencyNames[reserveEntry.currencyid];
    const lookupSymbol = getPriceLookupSymbol(reserveName);

    if (!lookupSymbol) {
      return reserveMap;
    }

    return {
      ...reserveMap,
      [lookupSymbol]: {
        ...reserveEntry,
        lookupSymbol,
        name: reserveName
      }
    };
  }, {});
};

const calculateReserveDerivedPrice = (reserveMap, symbol) => {
  if (symbol === 'DAI') {
    return 1;
  }

  const daiReserve = reserveMap.DAI;
  const targetReserve = reserveMap[symbol];
  const daiPriceInReserve = toFiniteNumber(daiReserve?.priceinreserve);
  const targetPriceInReserve = toFiniteNumber(targetReserve?.priceinreserve);

  if (!Number.isFinite(daiPriceInReserve) || !Number.isFinite(targetPriceInReserve) || targetPriceInReserve <= 0) {
    return null;
  }

  return daiPriceInReserve / targetPriceInReserve;
};

const calculateFractionalCurrencyPriceInDai = (currencyResult) => {
  const state = getCurrencyState(currencyResult);
  const reserveMap = getReserveEntriesBySymbol(currencyResult);
  const daiReserve = reserveMap.DAI;
  const daiReserves = toFiniteNumber(daiReserve?.reserves);
  const daiWeight = toFiniteNumber(daiReserve?.weight);
  const supply = toFiniteNumber(state?.supply);

  if (!Number.isFinite(daiReserves) || !Number.isFinite(daiWeight) || !Number.isFinite(supply) || daiWeight <= 0 || supply <= 0) {
    return null;
  }

  return daiReserves / daiWeight / supply;
};

const buildBridgeReferencePriceBySymbol = (bridgeCurrencyResult) => {
  const reserveMap = getReserveEntriesBySymbol(bridgeCurrencyResult);

  return {
    BRIDGE: calculateFractionalCurrencyPriceInDai(bridgeCurrencyResult),
    DAI: 1,
    ETH: calculateReserveDerivedPrice(reserveMap, 'ETH'),
    MKR: calculateReserveDerivedPrice(reserveMap, 'MKR'),
    VRSC: calculateReserveDerivedPrice(reserveMap, 'VRSC')
  };
};

const buildFloralisReferencePriceBySymbol = (floralisCurrencyResult) => {
  const reserveMap = getReserveEntriesBySymbol(floralisCurrencyResult);

  return {
    EURC: calculateReserveDerivedPrice(reserveMap, 'EURC'),
    SCRVUSD: calculateReserveDerivedPrice(reserveMap, 'SCRVUSD'),
    TBTC: calculateReserveDerivedPrice(reserveMap, 'TBTC'),
    USDT: calculateReserveDerivedPrice(reserveMap, 'USDT')
  };
};

const buildInternalPricingSnapshot = ({ bridgeCurrencyResult, floralisCurrencyResult }) => {
  const bridgeReferencePriceBySymbol = buildBridgeReferencePriceBySymbol(bridgeCurrencyResult);
  const floralisReferencePriceBySymbol = buildFloralisReferencePriceBySymbol(floralisCurrencyResult);
  const usdPriceBySymbol = {
    ...STATIC_USD_PRICE_BY_SYMBOL
  };
  const priceSourceBySymbol = {
    DAI: PRICE_SOURCE_PEG,
    USDC: PRICE_SOURCE_PEG,
    USDT: PRICE_SOURCE_PEG
  };

  ['BRIDGE', 'ETH', 'MKR', 'VRSC'].forEach((symbol) => {
    const usdPrice = bridgeReferencePriceBySymbol[symbol];

    if (Number.isFinite(usdPrice)) {
      usdPriceBySymbol[symbol] = usdPrice;
      priceSourceBySymbol[symbol] = PRICE_SOURCE_BRIDGE;
    }
  });

  ['EURC', 'SCRVUSD', 'TBTC'].forEach((symbol) => {
    const usdPrice = floralisReferencePriceBySymbol[symbol];

    if (Number.isFinite(usdPrice)) {
      usdPriceBySymbol[symbol] = usdPrice;
      priceSourceBySymbol[symbol] = PRICE_SOURCE_FLORALIS;
    }
  });

  return {
    bridgeReferencePriceBySymbol,
    floralisReferencePriceBySymbol,
    lastUpdatedAt: Date.now(),
    priceSourceBySymbol,
    usdPriceBySymbol
  };
};

const getQuoteWarningDestinationSymbol = (destination) => BRIDGE_WARNING_DESTINATION_SYMBOL_BY_VALUE[destination] || null;

const getSourceWarningSymbol = (selectedToken) => getPriceLookupSymbol(getTokenDisplaySymbol(selectedToken));

const toIAddressFromHexCurrency = (currencyValue) => {
  if (!currencyValue || !currencyValue.startsWith('0x')) {
    return null;
  }

  try {
    return bitGoUTXO.address.toBase58Check(Buffer.from(currencyValue.slice(2), 'hex'), 102);
  } catch (error) {
    return null;
  }
};

const createEmptyWarningState = () => ({
  conversionWarningGapPercent: null,
  conversionWarningKind: null,
  conversionWarningMessage: ''
});

const compareSourceCurrenciesByWalletValue = (left, right) => {
  const leftFiat = Number.isFinite(left?.fiatValue) ? left.fiatValue : -1;
  const rightFiat = Number.isFinite(right?.fiatValue) ? right.fiatValue : -1;
  const fiatDifference = rightFiat - leftFiat;

  if (Math.abs(fiatDifference) > BALANCE_SORT_EPSILON) {
    return fiatDifference;
  }

  const leftBalance = Number.isFinite(left?.balance) ? left.balance : -1;
  const rightBalance = Number.isFinite(right?.balance) ? right.balance : -1;
  const balanceDifference = rightBalance - leftBalance;

  if (Math.abs(balanceDifference) > BALANCE_SORT_EPSILON) {
    return balanceDifference;
  }

  const nameComparison = (left?.name || '').localeCompare(right?.name || '', undefined, { sensitivity: 'base' });
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return (left?.id || '').localeCompare(right?.id || '', undefined, { sensitivity: 'base' });
};

const normalizeContractField = (value) => {
  const trimmedValue = value?.trim();
  return trimmedValue || undefined;
};

const createSeededEthToken = () => ({
  label: 'vETH',
  name: 'vETH',
  ticker: 'ETH',
  value: GLOBAL_ADDRESS.ETH,
  iaddress: GLOBAL_IADDRESS.ETH,
  erc20address: ZERO_ADDRESS,
  flags: '0',
  ethereumName: 'Ethereum',
  ethereumSymbol: 'ETH'
});

const getTokenValueKey = (token) => (token?.value || '').toLowerCase();

const mergeTokenChoicesWithSeededEth = (tokenOptions) => {
  const uniqueTokens = new Map();

  [createSeededEthToken(), ...(tokenOptions || [])].forEach((token) => {
    const tokenValueKey = getTokenValueKey(token);
    if (!tokenValueKey) {
      return;
    }

    uniqueTokens.set(tokenValueKey, token);
  });

  return [...uniqueTokens.values()];
};

const getPreferredSourceToken = (tokenOptions, selectedToken) => {
  const selectedTokenKey = getTokenValueKey(selectedToken);
  const matchingSelectedToken = selectedTokenKey
    ? tokenOptions.find((option) => getTokenValueKey(option) === selectedTokenKey)
    : null;

  if (matchingSelectedToken) {
    return matchingSelectedToken;
  }

  return tokenOptions.find((option) => getTokenValueKey(option) === ETH_SOURCE_TOKEN_VALUE) || tokenOptions[0] || null;
};

const QUOTE_TARGET_IADDRESS_BY_DESTINATION = {
  bridgeBRIDGE: GLOBAL_IADDRESS.BETH,
  bridgeVRSC: GLOBAL_IADDRESS.VRSC,
  bridgeDAI: GLOBAL_IADDRESS.DAI,
  bridgeETH: GLOBAL_IADDRESS.ETH,
  bridgeMKR: GLOBAL_IADDRESS.MKR,
  swaptoBRIDGE: GLOBAL_IADDRESS.BETH,
  swaptoVRSC: GLOBAL_IADDRESS.VRSC,
  swaptoDAI: GLOBAL_IADDRESS.DAI,
  swaptoETH: GLOBAL_IADDRESS.ETH,
  swaptoMKR: GLOBAL_IADDRESS.MKR
};

const isConversionDestination = (destination) => Boolean(QUOTE_TARGET_IADDRESS_BY_DESTINATION[destination]);

const getQuoteTargetIAddress = (destination) => QUOTE_TARGET_IADDRESS_BY_DESTINATION[destination] || null;

const toTokenOption = (token, metadata = {}) => ({
  label: token.name,
  name: token.name,
  ticker: token.ticker,
  value: token.iaddress,
  iaddress: token.iaddress,
  erc20address: token.erc20ContractAddress,
  flags: token.flags,
  ...metadata
});

const getBaseBridgeFeeWei = () => new web3.utils.BN(web3.utils.toWei(ETH_FEES.ETH, 'ether'));

const getMinimumGatewayFeeWei = () => (
  new web3.utils.BN(MINIMUM_GAS_PRICE_WEI).mul(new web3.utils.BN(GAS_TRANSACTIONIMPORTFEE))
);

const hasLiveGasEstimate = (gasPrice) => Boolean(gasPrice?.WEICOST && gasPrice?.SATSCOST);

const getGatewayFeeWei = (destination, gasPrice) => {
  if (!destination || !destination.startsWith('swapto')) {
    return new web3.utils.BN('0');
  }

  return hasLiveGasEstimate(gasPrice)
    ? new web3.utils.BN(gasPrice.WEICOST)
    : getMinimumGatewayFeeWei();
};

const getFeeEstimateWei = (destination, gasPrice) => (
  getBaseBridgeFeeWei().add(getGatewayFeeWei(destination, gasPrice))
);

const parseAmountToWei = (value) => {
  if (!value) {
    return null;
  }

  try {
    return new web3.utils.BN(web3.utils.toWei(value, 'ether'));
  } catch (error) {
    return null;
  }
};

const formatEthValue = (value) => {
  const parsedValue = parseFloat(value);
  if (!Number.isFinite(parsedValue)) {
    return '--';
  }

  return `${parsedValue.toFixed(parsedValue < 0.01 ? 4 : 3)} ETH`;
};

const formatEthFromWei = (value) => {
  if (value === null || value === undefined) {
    return '--';
  }

  try {
    return formatEthValue(web3.utils.fromWei(value.toString(), 'ether'));
  } catch (error) {
    return '--';
  }
};

const getRequiredNativeEthWei = ({ amount, destination, gasPrice, selectedToken }) => {
  if (!selectedToken) {
    return null;
  }

  let totalFee = getFeeEstimateWei(destination, gasPrice);

  if (selectedToken.value === GLOBAL_ADDRESS.ETH) {
    const amountWei = parseAmountToWei(amount);
    if (amountWei === null) {
      return null;
    }

    totalFee = totalFee.add(amountWei);
  }

  return totalFee;
};

const getFeeEstimateValue = (destination, gasPrice) => {
  const totalFee = getFeeEstimateWei(destination, gasPrice);
  const feeAsEth = parseFloat(web3.utils.fromWei(totalFee.toString(), 'ether'));

  if (Number.isNaN(feeAsEth)) {
    return parseFloat(ETH_FEES.ETH);
  }

  return feeAsEth;
};

const formatFeeEstimate = (destination, gasPrice) => {
  const feeAsEth = getFeeEstimateValue(destination, gasPrice);
  return `${feeAsEth.toFixed(feeAsEth < 0.01 ? 4 : 3)} ETH`;
};

const getRouteLabel = (destination) => {
  if (!destination) {
    return 'Choose a destination';
  }

  if (destination.startsWith('swapto')) {
    return 'Ethereum -> Verus -> Ethereum';
  }

  return 'Ethereum -> Verus';
};

const getRouteTimeEstimate = (destination) => (
  destination?.startsWith('swapto')
    ? '2-10 hours'
    : '1-6 hours'
);

const getGasEstimate = async (library) => {
  const latestBlock = await library.getBlockNumber();
  let block = await library.getBlock(latestBlock - 10);
  if (block.transactions.length < 1) {
    block = await library.getBlock(latestBlock - 11);
  }

  const transaction = await library.getTransaction(block.transactions[Math.ceil(block.transactions.length / 2)]);
  const gasPriceInWei = new web3.utils.BN(transaction.gasPrice.toString());
  const gasPriceWithBuffer = gasPriceInWei
    .mul(new web3.utils.BN('12'))
    .div(new web3.utils.BN('10'));

  if (gasPriceWithBuffer.lt(new web3.utils.BN(MINIMUM_GAS_PRICE_WEI))) {
    return {
      SATSCOST: new web3.utils.BN(GAS_TRANSACTIONIMPORTFEE).toString(),
      WEICOST: new web3.utils.BN(MINIMUM_GAS_PRICE_WEI)
        .mul(new web3.utils.BN(GAS_TRANSACTIONIMPORTFEE))
        .toString()
    };
  }

  return {
    SATSCOST: gasPriceWithBuffer
      .mul(new web3.utils.BN(GAS_TRANSACTIONIMPORTFEE))
      .div(new web3.utils.BN('10000000000'))
      .toString(),
    WEICOST: gasPriceWithBuffer
      .mul(new web3.utils.BN(GAS_TRANSACTIONIMPORTFEE))
      .toString()
  };
};

const validateBridgeAmount = async ({ account, amount, delegatorContract, library, selectedToken }) => {
  if (!amount) {
    return 'Amount is required';
  }

  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return 'Amount is not valid.';
  }

  if (parsedAmount > 100000000) {
    return 'Amount too large. Try a smaller amount.';
  }

  if (!account || !selectedToken || !library || !delegatorContract) {
    return true;
  }

  const tokenLabel = getTokenDisplaySymbol(selectedToken) || selectedToken.name;

  if (selectedToken.value === GLOBAL_ADDRESS.ETH) {
    const nativeBalance = await library.getBalance(account);
    const ethBalance = parseFloat(utils.formatEther(nativeBalance));
    return ethBalance >= parsedAmount
      ? true
      : `Amount is not available in your wallet. ${ethBalance} ${tokenLabel}`;
  }

  const mappedData = await delegatorContract.callStatic.verusToERC20mapping(selectedToken.value);
  if (parseInt(mappedData.flags, 10) > 0) {
    const tokenContract = getContract(selectedToken.erc20address, ERC20_ABI, library, account);
    const maxAmount = await getMaxAmount(tokenContract, account);
    return maxAmount >= parsedAmount
      ? true
      : `Amount is not available in your wallet. ${maxAmount} ${tokenLabel}`;
  }

  return true;
};

const fetchSelectedTokenBalance = async ({ account, library, selectedToken }) => {
  if (!account || !library || !selectedToken) {
    return null;
  }

  const tokenLabel = getTokenDisplaySymbol(selectedToken) || selectedToken.name;

  if (selectedToken.value === GLOBAL_ADDRESS.ETH) {
    const nativeBalance = await library.getBalance(account);
    const balance = utils.formatEther(nativeBalance);
    return {
      raw: balance,
      display: `${formatBalance(balance)} ${tokenLabel}`
    };
  }

  const tokenContract = getContract(selectedToken.erc20address, ERC20_ABI, library, account);
  const balance = await getMaxAmount(tokenContract, account);

  return {
    raw: `${balance}`,
    display: `${formatBalance(balance)} ${tokenLabel}`
  };
};

const getEthereumTokenMetadata = async (library, token) => {
  if (!library || !token) {
    return {};
  }

  const tokenAddress = token.erc20ContractAddress || token.erc20address;

  if (
    (token.iaddress || token.value || '').toLowerCase() === GLOBAL_ADDRESS.ETH.toLowerCase() ||
    token.ticker === 'ETH'
  ) {
    return { ethereumName: 'Ethereum', ethereumSymbol: 'ETH' };
  }

  try {
    const tokenContract = getContract(tokenAddress, ERC20_ABI, library);
    const [ethereumName, ethereumSymbol] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol()
    ]);

    return {
      ethereumName: normalizeContractField(ethereumName),
      ethereumSymbol: normalizeContractField(ethereumSymbol)
    };
  } catch (error) {
    return {};
  }
};

const getTokenChoices = async (delegatorContract, poolAvailable) => {
  const tokens = await delegatorContract.callStatic.getTokenList(0, 0);
  const tokenOptions = tokens.map((token) => toTokenOption(token));

  return getTokenOptions(poolAvailable, tokenOptions);
};

const enrichTokenChoices = async (library, tokenOptions) => Promise.all(
  tokenOptions.map(async (token) => ({
    ...token,
    ...(await getEthereumTokenMetadata(library, token))
  }))
);

export default function useBridgeController({
  enterReview,
  exitReview,
  isReviewRequested = false
} = {}) {
  const [alert, setAlert] = useState(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [amountError, setAmountError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [receiveQuote, setReceiveQuote] = useState({
    signature: '',
    state: 'not-required',
    value: null
  });
  const [destination, setDestination] = useState('');
  const [gasPrice, setGasPrice] = useState(null);
  const [internalPricingSnapshot, setInternalPricingSnapshot] = useState(() => ({
    bridgeReferencePriceBySymbol: {},
    floralisReferencePriceBySymbol: {},
    lastUpdatedAt: null,
    priceSourceBySymbol: {
      DAI: PRICE_SOURCE_PEG,
      USDC: PRICE_SOURCE_PEG,
      USDT: PRICE_SOURCE_PEG
    },
    usdPriceBySymbol: {
      ...STATIC_USD_PRICE_BY_SYMBOL
    }
  }));
  const [isSourceCatalogLoading, setIsSourceCatalogLoading] = useState(true);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isWalletBalancesLoading, setIsWalletBalancesLoading] = useState(false);
  const [natiCurrencyId, setNatiCurrencyId] = useState(null);
  const [natiComparisonQuote, setNatiComparisonQuote] = useState({
    signature: '',
    state: 'not-required',
    value: null
  });
  const [poolAvailable, setPoolAvailable] = useState(false);
  const [pubkey, setPubkey] = useState({});
  const [reviewSnapshot, setReviewSnapshot] = useState(null);
  const hasReviewSnapshot = Boolean(reviewSnapshot);
  const isReviewing = Boolean(isReviewRequested && reviewSnapshot);
  const [selectedToken, setSelectedToken] = useState(() => createSeededEthToken());
  const [sourceCatalogError, setSourceCatalogError] = useState(null);
  const [sourceCatalogRetryNonce, setSourceCatalogRetryNonce] = useState(0);
  const [tokenOptions, setTokenOptions] = useState(() => [createSeededEthToken()]);
  const [walletTokenBalances, setWalletTokenBalances] = useState([]);
  const [notarizationLagBlocks, setNotarizationLagBlocks] = useState(null);
  const [notarizationLagSeconds, setNotarizationLagSeconds] = useState(null);
  const [verusChainHeight, setVerusChainHeight] = useState(null);
  const [verusTipHeight, setVerusTipHeight] = useState(null);
  const { account, library } = useWeb3React();
  const { addToast } = useToast();
  const delegatorContract = useContract(DELEGATOR_ADD, DELEGATOR_ABI);

  const destinationOptions = useMemo(
    () => getDestinationOptions(poolAvailable, address, selectedToken?.value, selectedToken?.name),
    [address, poolAvailable, selectedToken]
  );
  const allowsEthereumDestination = useMemo(
    () => !supportsOnlyDirectVerusDestination(poolAvailable, selectedToken?.value),
    [poolAvailable, selectedToken]
  );

  const selectedDestination = useMemo(
    () => destinationOptions.find((option) => option.value === destination) || null,
    [destination, destinationOptions]
  );

  const receiveCurrency = useMemo(
    () => (selectedDestination ? buildDestinationCurrency(selectedDestination, selectedToken) : null),
    [selectedDestination, selectedToken]
  );

  const effectiveTokenUsdPrices = useMemo(
    () => internalPricingSnapshot.usdPriceBySymbol,
    [internalPricingSnapshot.usdPriceBySymbol]
  );
  const priceSourceBySymbol = useMemo(
    () => internalPricingSnapshot.priceSourceBySymbol,
    [internalPricingSnapshot.priceSourceBySymbol]
  );
  const bridgeReferencePriceBySymbol = useMemo(
    () => internalPricingSnapshot.bridgeReferencePriceBySymbol,
    [internalPricingSnapshot.bridgeReferencePriceBySymbol]
  );
  const ethUsdPrice = useMemo(
    () => (Number.isFinite(effectiveTokenUsdPrices.ETH) ? effectiveTokenUsdPrices.ETH : null),
    [effectiveTokenUsdPrices]
  );

  const editSignature = useMemo(() => [
    account || '',
    address || '',
    amount || '',
    destination || '',
    selectedToken?.value || ''
  ].join('|'), [account, address, amount, destination, selectedToken]);

  const tokenBalance = useMemo(() => {
    if (!account || !selectedToken) {
      return null;
    }

    const matchingBalance = walletTokenBalances.find((entry) => entry.token.value === selectedToken.value);
    if (!matchingBalance) {
      return null;
    }

    return {
      raw: matchingBalance.raw,
      display: matchingBalance.display
    };
  }, [account, selectedToken, walletTokenBalances]);

  const sourceCurrencies = useMemo(() => {
    if (!account) {
      return sortSourceCurrencies(tokenOptions.map((token) => buildTokenCurrency(token)));
    }

    return walletTokenBalances
      .filter((entry) => entry.balance > 0)
      .map((entry) => {
        const symbol = getTokenDisplaySymbol(entry.token) || entry.token.name;
        const fiatPrice = effectiveTokenUsdPrices[getPriceLookupSymbol(symbol)];
        const fiatValue = Number.isFinite(fiatPrice) ? entry.balance * fiatPrice : null;

        return buildTokenCurrency(entry.token, {
          balance: entry.balance,
          balanceLabel: `${formatBalance(entry.balance)} ${symbol}`,
          fiatLabel: Number.isFinite(fiatValue) ? formatCurrencyFiat(fiatValue) : null,
          fiatValue
        });
      })
      .sort(compareSourceCurrenciesByWalletValue);
  }, [account, effectiveTokenUsdPrices, tokenOptions, walletTokenBalances]);

  const amountFiatLabel = useMemo(
    () => getAmountFiatLabel(amount, getTokenDisplaySymbol(selectedToken), effectiveTokenUsdPrices),
    [amount, effectiveTokenUsdPrices, selectedToken]
  );

  const isDirectVerusReceive = selectedDestination?.value === BLOCKCHAIN_NAME;
  const requiresReceiveQuote = useMemo(
    () => isConversionDestination(selectedDestination?.value),
    [selectedDestination]
  );
  const normalizedQuoteAmount = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) {
      return '';
    }

    return uint64ToVerusFloat(coinsToSats(amount));
  }, [amount]);
  const quoteSignature = useMemo(() => (
    requiresReceiveQuote
      ? [
        selectedToken?.value || '',
        destination || '',
        normalizedQuoteAmount,
        poolAvailable ? '1' : '0'
      ].join('|')
      : ''
  ), [destination, normalizedQuoteAmount, poolAvailable, requiresReceiveQuote, selectedToken]);
  const shouldFetchReceiveQuote = Boolean(
    requiresReceiveQuote
    && selectedToken
    && destination
    && normalizedQuoteAmount
  );
  const warningDestinationSymbol = useMemo(
    () => getQuoteWarningDestinationSymbol(destination),
    [destination]
  );
  const warningSourceSymbol = useMemo(
    () => getSourceWarningSymbol(selectedToken),
    [selectedToken]
  );
  const shouldFetchNatiComparison = Boolean(
    warningDestinationSymbol === 'VRSC'
    && warningSourceSymbol === 'ETH'
    && selectedToken
    && normalizedQuoteAmount
  );
  const natiComparisonSignature = useMemo(() => (
    shouldFetchNatiComparison
      ? [
        selectedToken?.value || '',
        destination || '',
        normalizedQuoteAmount
      ].join('|')
      : ''
  ), [destination, normalizedQuoteAmount, selectedToken, shouldFetchNatiComparison]);
  const receiveQuoteState = useMemo(() => {
    if (!requiresReceiveQuote) {
      return 'not-required';
    }

    if (!shouldFetchReceiveQuote) {
      return 'pending';
    }

    if (receiveQuote.signature !== quoteSignature) {
      return 'pending';
    }

    return receiveQuote.state;
  }, [quoteSignature, receiveQuote.signature, receiveQuote.state, requiresReceiveQuote, shouldFetchReceiveQuote]);
  const hasFreshReceiveQuote = useMemo(() => (
    !requiresReceiveQuote || (
      shouldFetchReceiveQuote
      && receiveQuote.signature === quoteSignature
      && receiveQuote.state === 'ready'
    )
  ), [quoteSignature, receiveQuote.signature, receiveQuote.state, requiresReceiveQuote, shouldFetchReceiveQuote]);
  const reviewReceiveAmountDisplay = reviewSnapshot?.receiveAmountDisplay || '';
  const reviewReceiveFiatLabel = reviewSnapshot?.receiveFiatLabel || null;
  const addressHint = useMemo(
    () => (
      allowsEthereumDestination
        ? 'Enter a Verus address (R-address or i-address) or Ethereum address'
        : 'Enter a Verus address (R-address or i-address)'
    ),
    [allowsEthereumDestination]
  );
  const addressPlaceholder = useMemo(
    () => (allowsEthereumDestination ? 'Enter receiving address' : 'Enter Verus receiving address'),
    [allowsEthereumDestination]
  );
  const destinationEmptyStateMessage = useMemo(() => {
    if (!allowsEthereumDestination && isETHAddress(address)) {
      return 'This asset can only be received at a Verus address.';
    }

    return 'No currencies available yet. Enter a valid destination address to unlock receive options.';
  }, [address, allowsEthereumDestination]);
  const requiresLiveGasEstimate = useMemo(
    () => Boolean(destination && destination.startsWith('swapto')),
    [destination]
  );

  const receiveAmountDisplay = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) {
      return '--';
    }

    if (!selectedDestination) {
      return '--';
    }

    if (isDirectVerusReceive) {
      return formatQuotedAmount(normalizedQuoteAmount);
    }

    if (receiveQuoteState !== 'ready') {
      return 'Estimating...';
    }

    return formatQuotedAmount(receiveQuote.value);
  }, [amount, isDirectVerusReceive, normalizedQuoteAmount, receiveQuote.value, receiveQuoteState, selectedDestination]);

  const receiveFiatLabel = useMemo(() => {
    if (!receiveCurrency) {
      return null;
    }

    if (!amount || parseFloat(amount) <= 0) {
      return null;
    }

    let receiveValue = null;

    if (isDirectVerusReceive) {
      receiveValue = normalizedQuoteAmount;
    } else if (receiveQuoteState === 'ready') {
      receiveValue = receiveQuote.value;
    }

    return getAmountFiatLabel(receiveValue, receiveCurrency.symbol, effectiveTokenUsdPrices);
  }, [
    amount,
    effectiveTokenUsdPrices,
    isDirectVerusReceive,
    normalizedQuoteAmount,
    receiveCurrency,
    receiveQuote.value,
    receiveQuoteState
  ]);
  const conversionWarning = useMemo(() => {
    if (receiveQuoteState !== 'ready' || !requiresReceiveQuote) {
      return createEmptyWarningState();
    }

    const parsedAmount = parseFloat(amount);
    const parsedQuoteOut = parseFloat(receiveQuote.value);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(parsedQuoteOut) || parsedQuoteOut <= 0) {
      return createEmptyWarningState();
    }

    if (
      warningDestinationSymbol === 'VRSC'
      && warningSourceSymbol === 'ETH'
      && natiComparisonQuote.signature === natiComparisonSignature
      && natiComparisonQuote.state === 'ready'
    ) {
      const parsedAlternateVenueOut = parseFloat(natiComparisonQuote.value);

      if (Number.isFinite(parsedAlternateVenueOut) && parsedAlternateVenueOut > parsedQuoteOut) {
        const betterVenueGapPercent = ((parsedAlternateVenueOut - parsedQuoteOut) / parsedQuoteOut) * 100;

        if (betterVenueGapPercent >= PRICE_WARNING_THRESHOLD_PERCENT) {
          return {
            conversionWarningGapPercent: betterVenueGapPercent,
            conversionWarningKind: 'better-venue',
            conversionWarningMessage: `This quote is ${betterVenueGapPercent.toFixed(1)}% below a better currently available route. You may get a better result by bridging to Verus first, then swapping there.`
          };
        }
      }
    }

    const sourceReferencePrice = bridgeReferencePriceBySymbol[warningSourceSymbol];
    const destinationReferencePrice = bridgeReferencePriceBySymbol[warningDestinationSymbol];

    if (!Number.isFinite(sourceReferencePrice) || !Number.isFinite(destinationReferencePrice) || destinationReferencePrice <= 0) {
      return createEmptyWarningState();
    }

    const bridgeSpotOutPerIn = sourceReferencePrice / destinationReferencePrice;
    const quotedOutPerIn = parsedQuoteOut / parsedAmount;
    const spotImpactGapPercent = ((bridgeSpotOutPerIn - quotedOutPerIn) / bridgeSpotOutPerIn) * 100;

    if (spotImpactGapPercent < PRICE_WARNING_THRESHOLD_PERCENT) {
      return createEmptyWarningState();
    }

    return {
      conversionWarningGapPercent: spotImpactGapPercent,
      conversionWarningKind: 'spot-impact',
      conversionWarningMessage: `This quote is ${spotImpactGapPercent.toFixed(1)}% below the current spot value.`
    };
  }, [
    amount,
    bridgeReferencePriceBySymbol,
    natiComparisonQuote.signature,
    natiComparisonQuote.state,
    natiComparisonQuote.value,
    natiComparisonSignature,
    receiveQuote.value,
    receiveQuoteState,
    requiresReceiveQuote,
    warningDestinationSymbol,
    warningSourceSymbol
  ]);

  const nativeEthBalanceRaw = useMemo(() => {
    if (!account) {
      return '0';
    }

    const nativeBalanceEntry = walletTokenBalances.find((entry) => entry.token.value === GLOBAL_ADDRESS.ETH);
    return nativeBalanceEntry?.raw || '0';
  }, [account, walletTokenBalances]);

  const nativeEthBalance = useMemo(() => {
    const parsedBalance = parseFloat(nativeEthBalanceRaw);
    return Number.isFinite(parsedBalance) ? parsedBalance : 0;
  }, [nativeEthBalanceRaw]);

  const requiredNativeEthWei = useMemo(
    () => getRequiredNativeEthWei({
      amount,
      destination,
      gasPrice,
      selectedToken
    }),
    [amount, destination, gasPrice, selectedToken]
  );

  const requiredNativeEth = useMemo(() => {
    if (!requiredNativeEthWei) {
      return null;
    }

    return parseFloat(web3.utils.fromWei(requiredNativeEthWei.toString(), 'ether'));
  }, [requiredNativeEthWei]);

  const hasEnoughNativeEth = useMemo(() => {
    if (!requiredNativeEthWei || !account) {
      return false;
    }

    const nativeBalanceWei = parseAmountToWei(nativeEthBalanceRaw);
    if (nativeBalanceWei === null) {
      return false;
    }

    return nativeBalanceWei.gte(requiredNativeEthWei);
  }, [account, nativeEthBalanceRaw, requiredNativeEthWei]);

  useEffect(() => {
    if (destinationOptions.length === 1) {
      const onlyDestination = destinationOptions[0].value;

      if (destination !== onlyDestination) {
        setDestination(onlyDestination);
      }

      return;
    }

    if (destination && !destinationOptions.some((option) => option.value === destination)) {
      setDestination('');
    }
  }, [destination, destinationOptions]);

  useEffect(() => {
    const nextSelectedToken = getPreferredSourceToken(tokenOptions, selectedToken);

    if (nextSelectedToken !== selectedToken) {
      setSelectedToken(nextSelectedToken);
    }
  }, [selectedToken, tokenOptions]);

  useEffect(() => {
    let ignore = false;

    const loadInternalPricing = async () => {
      const [bridgeCurrencyResult, floralisCurrencyResult] = await Promise.allSettled([
        verusd.getCurrency('bridge.veth'),
        verusd.getCurrency(FLORALIS_CURRENCY_NAME)
      ]);

      if (ignore) {
        return;
      }

      setInternalPricingSnapshot(buildInternalPricingSnapshot({
        bridgeCurrencyResult: bridgeCurrencyResult.status === 'fulfilled' ? bridgeCurrencyResult.value : null,
        floralisCurrencyResult: floralisCurrencyResult.status === 'fulfilled' ? floralisCurrencyResult.value : null
      }));
    };

    loadInternalPricing();
    const intervalId = window.setInterval(loadInternalPricing, INTERNAL_PRICE_POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadNatiCurrencyId = async () => {
      if (!shouldFetchNatiComparison || natiCurrencyId) {
        return;
      }

      try {
        const natiCurrencyResult = await verusd.getCurrency(NATI_CURRENCY_NAME);
        const nextNatiCurrencyId = natiCurrencyResult?.result?.currencyid || null;

        if (!ignore) {
          setNatiCurrencyId(nextNatiCurrencyId);
        }
      } catch (error) {
        if (!ignore) {
          setNatiCurrencyId(null);
        }
      }
    };

    loadNatiCurrencyId();

    return () => {
      ignore = true;
    };
  }, [natiCurrencyId, shouldFetchNatiComparison]);

  useEffect(() => {
    let ignore = false;

    const loadGasPrice = async () => {
      if (!library) {
        return;
      }

      try {
        const currentGasPrice = await getGasEstimate(library);
        if (!ignore) {
          setGasPrice(currentGasPrice);
        }
      } catch (error) {
        if (!ignore) {
          setGasPrice(null);
        }
      }
    };

    loadGasPrice();

    return () => {
      ignore = true;
    };
  }, [library]);

  useEffect(() => {
    let ignore = false;

    const loadSourceCatalog = async () => {
      if (!delegatorContract || !library) {
        return;
      }

      setIsSourceCatalogLoading(true);
      setSourceCatalogError(null);

      const loadSourceTokens = async () => {
        const isPoolAvailable = await delegatorContract.callStatic.bridgeConverterActive();
        const tokens = mergeTokenChoicesWithSeededEth(await getTokenChoices(delegatorContract, isPoolAvailable));

        if (ignore) {
          return false;
        }

        setPoolAvailable(isPoolAvailable);
        setTokenOptions(tokens);

        try {
          const enrichedTokens = mergeTokenChoicesWithSeededEth(await enrichTokenChoices(library, tokens));
          if (!ignore) {
            setTokenOptions(enrichedTokens);
          }
        } catch (error) {
          // Keep the base token list if metadata enrichment fails.
        }

        return true;
      };

      const handleSourceCatalogSuccess = (loaded) => {
        if (!loaded || ignore) {
          return;
        }

        setIsSourceCatalogLoading(false);
        setSourceCatalogError(null);
      };

      try {
        handleSourceCatalogSuccess(await loadSourceTokens());
      } catch (error) {
        try {
          handleSourceCatalogSuccess(await loadSourceTokens());
        } catch (finalError) {
          if (!ignore) {
            setIsSourceCatalogLoading(false);
            setSourceCatalogError('Unable to load all currencies right now.');
          }
        }
      }
    };

    loadSourceCatalog();

    return () => {
      ignore = true;
    };
  }, [delegatorContract, library, sourceCatalogRetryNonce]);

  useEffect(() => {
    let ignore = false;

    const loadBridgeStatus = async () => {
      if (!delegatorContract) {
        return;
      }

      const [forksResult, chainInfoResult] = await Promise.allSettled([
        delegatorContract.callStatic.bestForks(0),
        verusd.getInfo()
      ]);

      const nextVerusChainHeight = forksResult.status === 'fulfilled'
        ? parseNotarizationHeight(forksResult.value)
        : 1;
      const nextVerusTipHeight = chainInfoResult.status === 'fulfilled'
        ? toFiniteNumber(chainInfoResult.value?.result?.longestchain)
        : null;
      const tipTime = chainInfoResult.status === 'fulfilled'
        ? toFiniteNumber(chainInfoResult.value?.result?.tiptime)
        : null;
      const nextLagBlocks = nextVerusChainHeight > 1 && Number.isFinite(nextVerusTipHeight)
        ? Math.max(0, nextVerusTipHeight - nextVerusChainHeight)
        : null;

      let nextLagSeconds = null;

      if (nextVerusChainHeight > 1 && Number.isFinite(tipTime)) {
        try {
          const blockTime = await getBlockTime(nextVerusChainHeight);
          if (Number.isFinite(blockTime)) {
            nextLagSeconds = Math.max(0, tipTime - blockTime);
          }
        } catch (error) {
          nextLagSeconds = null;
        }
      }

      if (!Number.isFinite(nextLagSeconds) && Number.isFinite(nextLagBlocks)) {
        nextLagSeconds = Math.max(0, nextLagBlocks) * ESTIMATED_VERUS_BLOCK_TIME_SECONDS;
      }

      if (!ignore) {
        setVerusChainHeight(nextVerusChainHeight);
        setVerusTipHeight(nextVerusTipHeight);
        setNotarizationLagBlocks(nextLagBlocks);
        setNotarizationLagSeconds(nextLagSeconds);
      }
    };

    loadBridgeStatus();
    const intervalId = window.setInterval(loadBridgeStatus, BRIDGE_STATUS_POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [delegatorContract]);

  useEffect(() => {
    let ignore = false;

    const loadEstimate = async () => {
      if (!requiresReceiveQuote) {
        setReceiveQuote({
          signature: '',
          state: 'not-required',
          value: null
        });
        return;
      }

      if (!shouldFetchReceiveQuote) {
        setReceiveQuote({
          signature: quoteSignature,
          state: 'pending',
          value: null
        });
        return;
      }

      const convertTo = getQuoteTargetIAddress(destination);
      if (!convertTo) {
        setReceiveQuote({
          signature: quoteSignature,
          state: 'unavailable',
          value: null
        });
        return;
      }

      setReceiveQuote({
        signature: quoteSignature,
        state: 'pending',
        value: null
      });

      try {
        const fromIaddress = bitGoUTXO.address.toBase58Check(Buffer.from(selectedToken.value.slice(2), 'hex'), 102);
        const conversionPacket = {
          currency: fromIaddress,
          convertto: convertTo,
          amount: normalizedQuoteAmount
        };

        if (convertTo !== GLOBAL_IADDRESS.BETH && fromIaddress !== GLOBAL_IADDRESS.BETH && poolAvailable) {
          conversionPacket.via = GLOBAL_IADDRESS.BETH;
        }

        if (!Object.values(GLOBAL_ADDRESS).includes(selectedToken.value)) {
          setReceiveQuote({
            signature: quoteSignature,
            state: 'unavailable',
            value: null
          });
          return;
        }

        const estimation = await verusd.estimateConversion(conversionPacket);
        if (estimation?.result?.estimatedcurrencyout > 0) {
          if (!ignore) {
            setReceiveQuote({
              signature: quoteSignature,
              state: 'ready',
              value: `${estimation.result.estimatedcurrencyout}`
            });
          }
        } else if (!ignore) {
          setReceiveQuote({
            signature: quoteSignature,
            state: 'unavailable',
            value: null
          });
        }
      } catch (error) {
        if (!ignore) {
          setReceiveQuote({
            signature: quoteSignature,
            state: 'unavailable',
            value: null
          });
        }
      }
    };

    loadEstimate();

    return () => {
      ignore = true;
    };
  }, [destination, normalizedQuoteAmount, poolAvailable, quoteSignature, requiresReceiveQuote, selectedToken, shouldFetchReceiveQuote]);

  useEffect(() => {
    let ignore = false;

    const loadNatiComparisonQuote = async () => {
      if (!shouldFetchNatiComparison) {
        setNatiComparisonQuote({
          signature: '',
          state: 'not-required',
          value: null
        });
        return;
      }

      if (!natiCurrencyId) {
        setNatiComparisonQuote({
          signature: natiComparisonSignature,
          state: 'pending',
          value: null
        });
        return;
      }

      const fromIaddress = toIAddressFromHexCurrency(selectedToken?.value);
      if (!fromIaddress) {
        setNatiComparisonQuote({
          signature: natiComparisonSignature,
          state: 'unavailable',
          value: null
        });
        return;
      }

      setNatiComparisonQuote({
        signature: natiComparisonSignature,
        state: 'pending',
        value: null
      });

      try {
        const estimation = await verusd.estimateConversion({
          amount: normalizedQuoteAmount,
          convertto: GLOBAL_IADDRESS.VRSC,
          currency: fromIaddress,
          via: natiCurrencyId
        });

        if (ignore) {
          return;
        }

        if (estimation?.result?.estimatedcurrencyout > 0) {
          setNatiComparisonQuote({
            signature: natiComparisonSignature,
            state: 'ready',
            value: `${estimation.result.estimatedcurrencyout}`
          });
        } else {
          setNatiComparisonQuote({
            signature: natiComparisonSignature,
            state: 'unavailable',
            value: null
          });
        }
      } catch (error) {
        if (!ignore) {
          setNatiComparisonQuote({
            signature: natiComparisonSignature,
            state: 'unavailable',
            value: null
          });
        }
      }
    };

    loadNatiComparisonQuote();

    return () => {
      ignore = true;
    };
  }, [natiComparisonSignature, natiCurrencyId, normalizedQuoteAmount, selectedToken, shouldFetchNatiComparison]);

  useEffect(() => {
    let ignore = false;

    const checkAddress = async () => {
      if (!address) {
        setAddressError('');
        return;
      }

      const result = await validateAddress(address);
      if (!ignore) {
        setAddressError(result === true ? '' : result);
      }
    };

    const timeoutId = setTimeout(() => {
      checkAddress();
    }, 180);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [address]);

  useEffect(() => {
    let ignore = false;

    const checkAmount = async () => {
      if (!amount) {
        setAmountError('');
        return;
      }

      const result = await validateBridgeAmount({
        account,
        amount,
        delegatorContract,
        library,
        selectedToken
      });

      if (!ignore) {
        setAmountError(result === true ? '' : result);
      }
    };

    const timeoutId = setTimeout(() => {
      checkAmount();
    }, 180);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [account, amount, delegatorContract, library, selectedToken]);

  useEffect(() => {
    let ignore = false;

    const loadWalletBalances = async () => {
      if (!account || !library || tokenOptions.length === 0) {
        if (!ignore) {
          setWalletTokenBalances([]);
          setIsWalletBalancesLoading(false);
        }
        return;
      }

      setIsWalletBalancesLoading(true);

      const balances = await Promise.all(
        tokenOptions.map(async (token) => {
          const tokenLabel = getTokenDisplaySymbol(token) || token.name;
          const emptyBalance = {
            token,
            balance: 0,
            display: `${formatBalance(0)} ${tokenLabel}`,
            raw: '0'
          };

          try {
            const balance = await fetchSelectedTokenBalance({ account, library, selectedToken: token });
            const numericBalance = parseFloat(balance?.raw);

            return {
              token,
              balance: Number.isFinite(numericBalance) ? numericBalance : 0,
              display: balance?.display || emptyBalance.display,
              raw: balance?.raw || '0'
            };
          } catch (error) {
            return emptyBalance;
          }
        })
      );

      if (!ignore) {
        setWalletTokenBalances(balances);
        setIsWalletBalancesLoading(false);
      }
    };

    loadWalletBalances();

    return () => {
      ignore = true;
    };
  }, [account, library, tokenOptions]);

  useEffect(() => {
    let ignore = false;

    const loadRefundAddress = async () => {
      if (!account || !window.ethereum) {
        return;
      }

      const cachedItems = JSON.parse(localStorage.getItem(REFUND_ADDRESS_STORAGE_KEY) || '{}');
      if (cachedItems[account]) {
        setPubkey(cachedItems);
        return;
      }

      try {
        const { refundAddress } = await requestRefundAddressData(account);
        const nextItems = { ...cachedItems, [account]: refundAddress };

        localStorage.setItem(REFUND_ADDRESS_STORAGE_KEY, JSON.stringify(nextItems));
        if (!ignore) {
          setPubkey(nextItems);
        }
      } catch (error) {
        if (!ignore) {
          setAlert({
            severity: 'warning',
            message: `Error with public key: ${error.message}`
          });
        }
      }
    };

    loadRefundAddress();

    return () => {
      ignore = true;
    };
  }, [account]);

  const reviewRouteLabel = useMemo(() => getRouteLabel(destination), [destination]);
  const reviewTimeEstimate = getRouteTimeEstimate(destination);

  const reviewFeeRows = useMemo(() => {
    const networkCostWei = getGatewayFeeWei(destination, gasPrice);
    const networkCostEth = parseFloat(web3.utils.fromWei(networkCostWei.toString(), 'ether'));
    const bridgeFeeEth = parseFloat(ETH_FEES.ETH);
    const rows = [
      {
        id: 'bridge-fee',
        label: 'Bridge fee',
        value: formatEthValue(bridgeFeeEth),
        fiatLabel: getAmountFiatLabel(bridgeFeeEth, 'ETH', effectiveTokenUsdPrices)
      }
    ];

    if (!networkCostWei.isZero()) {
      rows.push({
        id: 'network-cost',
        label: 'Network cost',
        value: formatEthFromWei(networkCostWei),
        fiatLabel: Number.isFinite(networkCostEth)
          ? getAmountFiatLabel(networkCostEth, 'ETH', effectiveTokenUsdPrices)
          : null
      });
    }

    return rows;
  }, [destination, effectiveTokenUsdPrices, gasPrice]);

  const authoriseOneTokenAmount = async (tokenToAuthorise, amountToAuthorise) => {
    const tokenLabel = getTokenDisplaySymbol(tokenToAuthorise) || tokenToAuthorise.name;

    setAlert({
      severity: 'warning',
      message: `MetaMask will now allow the bridge contract to spend ${amountToAuthorise} ${tokenLabel} from your ${ETHEREUM_BLOCKCHAIN_NAME} balance.`
    });

    const tokenContract = getContract(tokenToAuthorise.erc20address, ERC20_ABI, library, account);
    const decimals = web3.utils.toBN(await tokenContract.decimals());
    const base = new web3.utils.BN(10).pow(new web3.utils.BN(decimals));
    const [wholePart = '0', fractionPart = '0'] = amountToAuthorise.split('.');

    if (amountToAuthorise.split('.').length > 2) {
      throw new Error('Too many decimal points');
    }

    if (fractionPart.length > decimals) {
      throw new Error('Too many decimal places');
    }

    let fraction = fractionPart;
    while (fraction.length < decimals) {
      fraction += '0';
    }

    const bigAmount = new web3.utils.BN(wholePart).mul(base).add(new web3.utils.BN(fraction));
    const approval = await tokenContract.approve(DELEGATOR_ADD, bigAmount.toString(), {
      from: account,
      gasLimit: maxGas2
    });

    setAlert({ severity: 'warning', message: 'Authorising ERC20 token. Please wait…' });
    const reply = await approval.wait();

    if (reply.status === 0) {
      throw new Error('Authorising ERC20 token spend failed. Please check your balance.');
    }

    setAlert({
      severity: 'info',
      message: `Authorisation confirmed. Review the amount in MetaMask before sending the bridge transaction.`
    });
  };

  const handleSubmit = async () => {
    if (!account) {
      setAlert({
        severity: 'info',
        message: 'Connect a wallet from the header before bridging assets.'
      });
      return;
    }

    if (!selectedToken || !destination) {
      setAlert({
        severity: 'warning',
        message: 'Select the asset you want to send and the asset you want to receive.'
      });
      return;
    }

    const validDestination = await validateAddress(address);
    if (validDestination !== true) {
      setAddressError(validDestination);
      return;
    }

    const validAmount = await validateBridgeAmount({
      account,
      amount,
      delegatorContract,
      library,
      selectedToken
    });

    if (validAmount !== true) {
      setAmountError(validAmount);
      return;
    }

    if (requiresLiveGasEstimate && !hasLiveGasEstimate(gasPrice)) {
      addToast({
        type: 'error',
        description: 'Ethereum network cost is still loading. Try again in a moment.'
      });
      return;
    }

    if (!hasEnoughNativeEth) {
      addToast({
        type: 'error',
        description: 'Not enough ETH to cover bridge fees.'
      });
      return;
    }

    setAlert(null);
    setIsTxPending(true);

    try {
      if (selectedToken.value !== GLOBAL_ADDRESS.ETH) {
        await authoriseOneTokenAmount(selectedToken, amount);
      }

      const result = getConfigOptions({
        address,
        amount,
        destination,
        poolAvailable,
        token: selectedToken,
        GASPrice: gasPrice,
        auxDest: pubkey[account]
      });

      if (!result) {
        throw new Error('Unable to prepare the bridge transfer.');
      }

      const {
        destinationaddress,
        destinationcurrency,
        destinationtype,
        feecurrency,
        fees,
        flagvalue,
        secondreserveid
      } = result;

      if (selectedToken.value === secondreserveid) {
        throw new Error('Cannot bounce back to the same currency.');
      }

      let metaMaskFee = new web3.utils.BN(web3.utils.toWei(ETH_FEES.ETH, 'ether'));
      if (hasGatewayFlag(destinationtype)) {
        metaMaskFee = metaMaskFee.add(new web3.utils.BN(gasPrice.WEICOST));
        if (!pubkey[account]) {
          throw new Error('No refund address is available for this wallet.');
        }
      }

      if (selectedToken.value === GLOBAL_ADDRESS.ETH) {
        metaMaskFee = metaMaskFee.add(new web3.utils.BN(web3.utils.toWei(amount, 'ether')));
      }

      const reserveTransfer = {
        version: 1,
        currencyvalue: {
          currency: selectedToken.value,
          amount: coinsToSats(amount)
        },
        flags: flagvalue,
        feecurrencyid: feecurrency,
        fees,
        destination: {
          destinationtype,
          destinationaddress
        },
        destcurrencyid: destinationcurrency,
        destsystemid: '0x0000000000000000000000000000000000000000',
        secondreserveid
      };

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Transaction timeout exceeded.'));
        }, 240000);
      });

      const txResult = await delegatorContract.sendTransfer(reserveTransfer, {
        from: account,
        gasLimit: maxGas,
        value: metaMaskFee.toString()
      });

      await Promise.race([txResult.wait(), timeoutPromise]);
      addToast({ type: 'success', description: 'Bridge transaction submitted successfully.' });
      setAlert(null);
    } catch (error) {
      addToast({
        type: 'error',
        description: error.message || 'Bridge transaction failed.'
      });
      setAlert(null);
    } finally {
      setIsTxPending(false);
    }
  };

  const submitDisabledReason = useMemo(() => {
    if (!account) {
      return 'Connect wallet in header';
    }

    if (!selectedToken) {
      return 'Select token';
    }

    if (!destination) {
      return 'Select output';
    }

    if (!amount || parseFloat(amount) <= 0) {
      return 'Enter amount';
    }

    if (!address) {
      return 'Enter destination';
    }

    if (addressError) {
      return 'Fix destination';
    }

    if (amountError) {
      return 'Fix amount';
    }

    if (requiresReceiveQuote && !hasFreshReceiveQuote) {
      return 'Awaiting receive quote';
    }

    if (requiresLiveGasEstimate && !hasLiveGasEstimate(gasPrice)) {
      return 'Awaiting network fee estimate';
    }

    return '';
  }, [
    account,
    addressError,
    amount,
    amountError,
    destination,
    gasPrice,
    hasFreshReceiveQuote,
    requiresLiveGasEstimate,
    requiresReceiveQuote,
    selectedToken
  ]);

  const clearReview = useCallback((shouldExitReview = false, exitReviewOptions = undefined) => {
    setReviewSnapshot(null);
    if (shouldExitReview && typeof exitReview === 'function') {
      exitReview(exitReviewOptions);
    }
  }, [exitReview]);

  const closeReview = useCallback(() => {
    clearReview(true, { hash: '' });
  }, [clearReview]);

  useEffect(() => {
    if (!reviewSnapshot) {
      return;
    }

    if (!submitDisabledReason && reviewSnapshot.editSignature === editSignature) {
      return;
    }

    clearReview(
      isReviewRequested,
      isReviewRequested ? { hash: HOME_BRIDGE_INTERFACE_HASH } : undefined
    );
  }, [clearReview, editSignature, isReviewRequested, reviewSnapshot, submitDisabledReason]);

  const openReview = useCallback(async () => {
    if (!account) {
      setAlert({
        severity: 'info',
        message: 'Connect a wallet from the header before bridging assets.'
      });
      return;
    }

    if (!selectedToken || !destination) {
      setAlert({
        severity: 'warning',
        message: 'Select the asset you want to send and the asset you want to receive.'
      });
      return;
    }

    const validDestination = await validateAddress(address);
    if (validDestination !== true) {
      setAddressError(validDestination);
      return;
    }

    const validAmount = await validateBridgeAmount({
      account,
      amount,
      delegatorContract,
      library,
      selectedToken
    });

    if (validAmount !== true) {
      setAmountError(validAmount);
      return;
    }

    if (requiresReceiveQuote && !hasFreshReceiveQuote) {
      return;
    }

    if (requiresLiveGasEstimate && !hasLiveGasEstimate(gasPrice)) {
      setAlert({
        severity: 'info',
        message: 'Estimating the Ethereum network cost for this bounceback route. Try again in a moment.'
      });
      return;
    }

    const nextReviewSnapshot = {
      editSignature,
      receiveAmountDisplay,
      receiveFiatLabel
    };

    setAlert(null);

    if (typeof enterReview === 'function') {
      // Commit the snapshot before entering the review URL so the page does not
      // normalize a transient ?step=review render back to edit mode.
      flushSync(() => {
        setReviewSnapshot(nextReviewSnapshot);
      });
      enterReview();
      return;
    }

    setReviewSnapshot(nextReviewSnapshot);
  }, [
    account,
    address,
    amount,
    delegatorContract,
    destination,
    editSignature,
    gasPrice,
    hasFreshReceiveQuote,
    library,
    receiveAmountDisplay,
    receiveFiatLabel,
    enterReview,
    requiresLiveGasEstimate,
    requiresReceiveQuote,
    selectedToken
  ]);

  const canConfirmReview = Boolean(
    isReviewing
    && !submitDisabledReason
    && hasEnoughNativeEth
    && !isTxPending
  );

  const reviewConfirmLabel = useMemo(() => {
    if (isTxPending) {
      return 'Submitting...';
    }

    return hasEnoughNativeEth ? 'Confirm' : 'Not enough ETH';
  }, [hasEnoughNativeEth, isTxPending]);

  const retrySourceCatalog = useCallback(() => {
    setSourceCatalogRetryNonce((currentValue) => currentValue + 1);
  }, []);

  return {
    account,
    address,
    addressHint,
    addressError,
    addressPlaceholder,
    alert,
    allowsEthereumDestination,
    amount,
    amountFiatLabel,
    amountError,
    baseBridgeFeeValue: getFeeEstimateValue('', gasPrice),
    baseBridgeFeeDisplay: formatFeeEstimate('', gasPrice),
    bounceBackFeeDisplay: formatFeeEstimate('swaptoETH', gasPrice),
    bounceBackFeeValue: getFeeEstimateValue('swaptoETH', gasPrice),
    canSubmit: !submitDisabledReason && !isTxPending,
    canConfirmReview,
    closeReview,
    conversionWarningGapPercent: conversionWarning.conversionWarningGapPercent,
    conversionWarningKind: conversionWarning.conversionWarningKind,
    conversionWarningMessage: conversionWarning.conversionWarningMessage,
    destination,
    destinationEmptyStateMessage,
    destinationOptions,
    estimatedDisplayValue: receiveAmountDisplay,
    estimatedFiatLabel: receiveFiatLabel,
    estimatedOutputLabel: receiveCurrency?.name || 'Select what you want to receive',
    ethUsdPrice,
    feeEstimate: formatFeeEstimate(destination, gasPrice),
    handleMaxAmount: () => {
      if (tokenBalance?.raw) {
        setAmount(tokenBalance.raw);
      }
    },
    handleSubmit,
    hasReviewSnapshot,
    hasEnoughNativeEth,
    isReviewing,
    isSourceCatalogLoading,
    isSourceCurrenciesLoading: isWalletBalancesLoading,
    isTxPending,
    isWalletConnected: Boolean(account),
    nativeEthBalance,
    notarizationLagBlocks,
    notarizationLagSeconds,
    openReview,
    poolAvailable,
    hasFreshReceiveQuote,
    receiveAmountDisplay,
    receiveCurrency,
    receiveFiatLabel,
    receiveQuoteState,
    requiredNativeEth,
    requiresReceiveQuote,
    reviewReceiveAmountDisplay,
    reviewReceiveFiatLabel,
    routeLabel: getRouteLabel(destination),
    reviewConfirmLabel,
    reviewFeeRows,
    reviewRouteLabel,
    reviewTimeEstimate,
    sourceCurrencies,
    priceSourceBySymbol,
    pricingLastUpdatedAt: internalPricingSnapshot.lastUpdatedAt,
    selectedDestination,
    selectedToken,
    selectDestination: (nextDestination) => setDestination(nextDestination),
    selectToken: (value) => {
      const nextToken = tokenOptions.find((option) => option.value === value) || null;
      setSelectedToken(nextToken);
    },
    retrySourceCatalog,
    setAddress: (nextAddress) => setAddress(nextAddress),
    setAmount: (nextAmount) => setAmount(nextAmount.replace(',', '.')),
    sourceCatalogError,
    submitDisabledReason,
    tokenBalance,
    tokenBalanceLabel: tokenBalance?.display || (account ? 'Loading wallet balance...' : 'Connect a wallet to view balance'),
    tokenOptions,
    usdPriceBySymbol: effectiveTokenUsdPrices,
    verusChainHeight,
    verusTipHeight
  };
}
