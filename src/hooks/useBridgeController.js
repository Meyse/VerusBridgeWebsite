import { useEffect, useMemo, useState } from 'react';

import { useWeb3React } from '@web3-react/core';
import { utils } from 'ethers';
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
import { getDestinationOptions, getTokenOptions } from 'utils/options';
import {
  REFUND_ADDRESS_STORAGE_KEY,
  requestRefundAddressData
} from 'utils/refundAddress';
import { coinsToSats, validateAddress } from 'utils/rules';
import { getConfigOptions } from 'utils/txConfig';

const maxGas = 1000000;
const maxGas2 = 100000;
const BRIDGE_STATUS_POLL_INTERVAL_MS = 60_000;
const ESTIMATED_VERUS_BLOCK_TIME_SECONDS = 60;
const FLAG_DEST_GATEWAY = 128;
const COINPAPRIKA_ETH_TICKER_URL = 'https://api.coinpaprika.com/v1/tickers/eth-ethereum';
const COINPAPRIKA_TICKER_ID_BY_SYMBOL = {
  BAT: 'bat-basic-attention-token',
  LINK: 'link-chainlink',
  MKR: 'mkr-maker',
  PAXG: 'paxg-pax-gold',
  TBTC: 'btc-bitcoin',
  VRSC: 'vrsc-verus-coin',
  WBTC: 'btc-bitcoin',
  XAUT: 'xaut-tether-gold'
};
const STATIC_USD_PRICE_BY_SYMBOL = {
  CRVUSD: 1,
  DAI: 1,
  EURC: 1,
  SCRVUSD: 1,
  USDC: 1,
  USDT: 1
};
const { GAS_TRANSACTIONIMPORTFEE, MINIMUM_GAS_PRICE_WEI } = ETH_FEES;
const verusd = new VerusdRpcInterface(GLOBAL_IADDRESS.VRSC, process.env.REACT_APP_VERUS_RPC_URL);
const hasGatewayFlag = (value) => Math.floor(Number(value) / FLAG_DEST_GATEWAY) % 2 === 1;
const BALANCE_SORT_EPSILON = 0.000001;

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

const toDisplayAmount = (value) => {
  if (!value && value !== 0) {
    return '--';
  }

  const parsedValue = parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return '--';
  }

  return parsedValue < 0.001 ? parsedValue.toFixed(8) : parsedValue.toFixed(3);
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

  if (['BETH', 'BRIDGE', 'VBRID'].includes(normalizedSymbol)) {
    return 'ETH';
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

const getFeeEstimateValue = (destination, gasPrice) => {
  const baseFee = new web3.utils.BN(web3.utils.toWei(ETH_FEES.ETH, 'ether'));
  const gatewayFee = destination && destination.startsWith('swapto') && gasPrice?.WEICOST
    ? new web3.utils.BN(gasPrice.WEICOST)
    : new web3.utils.BN('0');

  const totalFee = baseFee.add(gatewayFee);
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

export default function useBridgeController() {
  const [alert, setAlert] = useState(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [amountError, setAmountError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [currentOptionsPrices, setCurrentOptionsPrices] = useState(null);
  const [destination, setDestination] = useState('');
  const [ethUsdPrice, setEthUsdPrice] = useState(null);
  const [gasPrice, setGasPrice] = useState(null);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isWalletBalancesLoading, setIsWalletBalancesLoading] = useState(false);
  const [poolAvailable, setPoolAvailable] = useState(false);
  const [pubkey, setPubkey] = useState({});
  const [selectedToken, setSelectedToken] = useState(null);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [tokenUsdPrices, setTokenUsdPrices] = useState({});
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

  const selectedDestination = useMemo(
    () => destinationOptions.find((option) => option.value === destination) || null,
    [destination, destinationOptions]
  );

  const effectiveTokenUsdPrices = useMemo(() => ({
    ...STATIC_USD_PRICE_BY_SYMBOL,
    ...tokenUsdPrices,
    ...(Number.isFinite(ethUsdPrice) ? { ETH: ethUsdPrice } : {})
  }), [ethUsdPrice, tokenUsdPrices]);

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
        const fiatPrice = effectiveTokenUsdPrices[normalizePriceSymbol(symbol)];
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

  const estimatedFiatLabel = useMemo(() => {
    if (!selectedDestination) {
      return null;
    }

    const destinationCurrency = buildDestinationCurrency(selectedDestination, selectedToken);
    return getAmountFiatLabel(currentOptionsPrices?.value, destinationCurrency.symbol, effectiveTokenUsdPrices);
  }, [currentOptionsPrices?.value, effectiveTokenUsdPrices, selectedDestination, selectedToken]);

  useEffect(() => {
    if (!destinationOptions.some((option) => option.value === destination)) {
      setDestination('');
    }
  }, [destination, destinationOptions]);

  useEffect(() => {
    if (selectedToken || tokenOptions.length === 0) {
      return;
    }

    const defaultToken = tokenOptions.find((option) => option.value === GLOBAL_ADDRESS.ETH) || tokenOptions[0];
    if (defaultToken) {
      setSelectedToken(defaultToken);
    }
  }, [selectedToken, tokenOptions]);

  useEffect(() => {
    if (!selectedToken) {
      return;
    }

    const syncedToken = tokenOptions.find((option) => option.value === selectedToken.value);
    if (syncedToken && syncedToken !== selectedToken) {
      setSelectedToken(syncedToken);
    }
  }, [selectedToken, tokenOptions]);

  useEffect(() => {
    let ignore = false;

    const loadEthUsdPrice = async () => {
      try {
        const response = await fetch(COINPAPRIKA_ETH_TICKER_URL);
        if (!response.ok) {
          throw new Error('Unable to fetch ETH price.');
        }

        const result = await response.json();
        const price = result?.quotes?.USD?.price;

        if (!ignore && Number.isFinite(price)) {
          setEthUsdPrice(price);
        }
      } catch (error) {
        if (!ignore) {
          setEthUsdPrice(null);
        }
      }
    };

    loadEthUsdPrice();
    const intervalId = window.setInterval(loadEthUsdPrice, 60_000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadTokenUsdPrices = async () => {
      const symbolsToFetch = [...new Set(
        tokenOptions
          .map((token) => normalizePriceSymbol(getTokenDisplaySymbol(token)))
          .filter((symbol) => symbol && symbol !== 'ETH' && !STATIC_USD_PRICE_BY_SYMBOL[symbol] && COINPAPRIKA_TICKER_ID_BY_SYMBOL[symbol])
      )];

      if (symbolsToFetch.length === 0) {
        if (!ignore) {
          setTokenUsdPrices({});
        }
        return;
      }

      const priceResults = await Promise.allSettled(
        symbolsToFetch.map(async (symbol) => {
          const response = await fetch(`https://api.coinpaprika.com/v1/tickers/${COINPAPRIKA_TICKER_ID_BY_SYMBOL[symbol]}`);
          if (!response.ok) {
            throw new Error(`Unable to fetch ${symbol} price.`);
          }

          const result = await response.json();
          return [symbol, result?.quotes?.USD?.price];
        })
      );

      if (ignore) {
        return;
      }

      setTokenUsdPrices(priceResults.reduce((priceMap, result) => {
        if (result.status !== 'fulfilled') {
          return priceMap;
        }

        const [symbol, price] = result.value;
        if (Number.isFinite(price)) {
          return {
            ...priceMap,
            [symbol]: price
          };
        }

        return priceMap;
      }, {}));
    };

    loadTokenUsdPrices();
    const intervalId = window.setInterval(loadTokenUsdPrices, 60_000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [tokenOptions]);

  useEffect(() => {
    let ignore = false;

    const loadBridgeFormState = async () => {
      if (!delegatorContract || !library) {
        return;
      }

      try {
        const currentGasPrice = await getGasEstimate(library);
        const isPoolAvailable = await delegatorContract.callStatic.bridgeConverterActive();
        const tokens = await getTokenChoices(delegatorContract, isPoolAvailable);

        if (!ignore) {
          setGasPrice(currentGasPrice);
          setPoolAvailable(isPoolAvailable);
          setTokenOptions(tokens);
        }

        enrichTokenChoices(library, tokens)
          .then((enrichedTokens) => {
            if (!ignore) {
              setTokenOptions(enrichedTokens);
            }
          })
          .catch(() => {});
      } catch (error) {
        if (!ignore) {
          setTokenOptions([]);
        }
      }
    };

    loadBridgeFormState();

    return () => {
      ignore = true;
    };
  }, [delegatorContract, library]);

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
      if (!selectedToken || !destination || !amount || amount === '0') {
        setCurrentOptionsPrices(null);
        return;
      }

      try {
        const currencies = {
          [BLOCKCHAIN_NAME]: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.VRSC.slice(2), 'hex'), 102),
          bridgeBRIDGE: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.BETH.slice(2), 'hex'), 102),
          bridgeVRSC: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.VRSC.slice(2), 'hex'), 102),
          bridgeETH: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.ETH.slice(2), 'hex'), 102),
          bridgeDAI: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.DAI.slice(2), 'hex'), 102),
          bridgeMKR: bitGoUTXO.address.toBase58Check(Buffer.from(GLOBAL_ADDRESS.MKR.slice(2), 'hex'), 102)
        };

        const fromIaddress = bitGoUTXO.address.toBase58Check(Buffer.from(selectedToken.value.slice(2), 'hex'), 102);
        const convertTo = poolAvailable ? currencies[destination] : currencies.bridgeBRIDGE;
        const conversionPacket = { currency: fromIaddress, convertto: convertTo, amount };

        if (convertTo !== GLOBAL_IADDRESS.BETH && fromIaddress !== GLOBAL_IADDRESS.BETH && poolAvailable) {
          conversionPacket.via = GLOBAL_IADDRESS.BETH;
        }

        if (!Object.values(GLOBAL_ADDRESS).includes(selectedToken.value)) {
          setCurrentOptionsPrices(null);
          return;
        }

        const estimation = await verusd.estimateConversion(conversionPacket);
        if (estimation?.result?.estimatedcurrencyout > 0 && destination !== BLOCKCHAIN_NAME) {
          const currency = await verusd.getCurrency(convertTo);

          if (!ignore) {
            setCurrentOptionsPrices({
              value: `${estimation.result.estimatedcurrencyout}`,
              destination: currency.result.fullyqualifiedname
            });
          }
        } else if (!ignore) {
          setCurrentOptionsPrices(null);
        }
      } catch (error) {
        if (!ignore) {
          setCurrentOptionsPrices(null);
        }
      }
    };

    loadEstimate();

    return () => {
      ignore = true;
    };
  }, [amount, destination, poolAvailable, selectedToken]);

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

    return '';
  }, [account, addressError, amount, amountError, destination, selectedToken]);

  return {
    account,
    address,
    addressError,
    alert,
    amount,
    amountFiatLabel,
    amountError,
    baseBridgeFeeValue: getFeeEstimateValue('', gasPrice),
    baseBridgeFeeDisplay: formatFeeEstimate('', gasPrice),
    bounceBackFeeDisplay: formatFeeEstimate('swaptoETH', gasPrice),
    bounceBackFeeValue: getFeeEstimateValue('swaptoETH', gasPrice),
    canSubmit: !submitDisabledReason && !isTxPending,
    currentOptionsPrices,
    destination,
    destinationOptions,
    estimatedDisplayValue: toDisplayAmount(currentOptionsPrices?.value),
    estimatedFiatLabel,
    estimatedOutputLabel: currentOptionsPrices?.destination || selectedDestination?.label || 'Select what you want to receive',
    ethUsdPrice,
    feeEstimate: formatFeeEstimate(destination, gasPrice),
    handleMaxAmount: () => {
      if (tokenBalance?.raw) {
        setAmount(tokenBalance.raw);
      }
    },
    handleSubmit,
    isSourceCurrenciesLoading: isWalletBalancesLoading,
    isTxPending,
    isWalletConnected: Boolean(account),
    notarizationLagBlocks,
    notarizationLagSeconds,
    poolAvailable,
    routeLabel: getRouteLabel(destination),
    sourceCurrencies,
    selectedDestination,
    selectedToken,
    selectDestination: (nextDestination) => setDestination(nextDestination),
    selectToken: (value) => {
      const nextToken = tokenOptions.find((option) => option.value === value) || null;
      setSelectedToken(nextToken);
    },
    setAddress: (nextAddress) => setAddress(nextAddress),
    setAmount: (nextAmount) => setAmount(nextAmount.replace(',', '.')),
    submitDisabledReason,
    tokenBalance,
    tokenBalanceLabel: tokenBalance?.display || (account ? 'Loading wallet balance...' : 'Connect a wallet to view balance'),
    tokenOptions,
    verusChainHeight,
    verusTipHeight
  };
}
