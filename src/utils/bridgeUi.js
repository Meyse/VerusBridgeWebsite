import { BLOCKCHAIN_NAME, GLOBAL_ADDRESS, GLOBAL_IADDRESS } from 'constants/contractAddress';

const bridgeBlockName = BLOCKCHAIN_NAME.toUpperCase();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const POPULAR_SOURCE_CURRENCY_KEYS = [
  'ETH',
  'VRSC',
  'DAI',
  'MKR',
  'USDC',
  'TBTC',
  'USDT',
  'EURC',
  'SCRVUSD',
  'CRVUSD',
  'WBTC'
];
const POPULAR_SOURCE_CURRENCY_KEY_SET = new Set(POPULAR_SOURCE_CURRENCY_KEYS);

const PLACEHOLDER_ICON = '/icons/currencies/placeholder.svg';
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

const iconMap = {
  BAT: '/icons/currencies/bat.svg',
  BRIDGE: '/icons/currencies/bridgeveth.svg',
  CHIPS: '/icons/currencies/chips.svg',
  CRVUSD: '/icons/currencies/crvUSD.svg',
  DAI: '/icons/currencies/dai.svg',
  ETH: '/icons/currencies/eth.svg',
  EURC: '/icons/currencies/eurc.svg',
  KAIJU: '/icons/currencies/kaiju.svg',
  LINK: '/icons/currencies/link.svg',
  MKR: '/icons/currencies/mkr.svg',
  PAXG: '/icons/currencies/paxg.svg',
  PEAS: '/icons/currencies/peas.png',
  PEPECOIN: '/icons/currencies/pepecoin.png',
  PURE: '/icons/currencies/pure.svg',
  SCRVUSD: '/icons/currencies/scrvUSD.svg',
  SWITCH: '/icons/currencies/switch.svg',
  TBTC: '/icons/currencies/tbtc.svg',
  TRAC: '/icons/currencies/trac.svg',
  THUSD: '/icons/currencies/thusd.svg',
  USDC: '/icons/currencies/usdc.svg',
  USDT: '/icons/currencies/usdt.svg',
  VARRR: '/icons/currencies/varrr.svg',
  VRSC: '/icons/currencies/vrsc.svg',
  VRSCTEST: '/icons/currencies/vrsctest.svg',
  WBTC: '/icons/currencies/wbtc.svg',
  XAUT: '/icons/currencies/xaut.svg'
};

const symbolIconAliases = {
  BAT: 'BAT',
  BETH: 'BRIDGE',
  BRIDGE: 'BRIDGE',
  BRIDGEVETH: 'BRIDGE',
  CHIPS: 'CHIPS',
  CRVUSD: 'CRVUSD',
  DAI: 'DAI',
  ETH: 'ETH',
  EURC: 'EURC',
  KAIJU: 'KAIJU',
  KAU: 'KAIJU',
  LINK: 'LINK',
  MKR: 'MKR',
  PAXG: 'PAXG',
  PEAPODS: 'PEAS',
  PEAS: 'PEAS',
  PEPECOIN: 'PEPECOIN',
  PURE: 'PURE',
  SCRVUSD: 'SCRVUSD',
  SWITCH: 'SWITCH',
  TBTC: 'TBTC',
  TRAC: 'TRAC',
  TRACETOKEN: 'TRAC',
  THUSD: 'THUSD',
  USDC: 'USDC',
  USDT: 'USDT',
  VARRR: 'VARRR',
  VBRID: 'BRIDGE',
  VRSC: 'VRSC',
  VRSCTEST: 'VRSCTEST',
  WBTC: 'WBTC',
  XAUT: 'XAUT'
};

const addressIconAliases = {
  [GLOBAL_ADDRESS.BETH.toLowerCase()]: 'BRIDGE',
  [GLOBAL_ADDRESS.DAI.toLowerCase()]: 'DAI',
  [GLOBAL_ADDRESS.ETH.toLowerCase()]: 'ETH',
  [GLOBAL_ADDRESS.MKR.toLowerCase()]: 'MKR',
  [GLOBAL_ADDRESS.VRSC.toLowerCase()]: bridgeBlockName,
  [GLOBAL_IADDRESS.BETH.toLowerCase()]: 'BRIDGE',
  [GLOBAL_IADDRESS.DAI.toLowerCase()]: 'DAI',
  [GLOBAL_IADDRESS.ETH.toLowerCase()]: 'ETH',
  [GLOBAL_IADDRESS.MKR.toLowerCase()]: 'MKR',
  [GLOBAL_IADDRESS.VRSC.toLowerCase()]: bridgeBlockName,
  '0x1abaae1f7c830bd89acc67ec4af516284b1bc33c': 'EURC',
  '0x18084fba666a33d37592fa2633fd49a74dd93a88': 'TBTC',
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': 'BAT',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
  '0x45804880de22913dafe09f4980848ece6ecbaf78': 'PAXG',
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINK',
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'MKR',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
  '0xbc2738ba63882891094c99e59a02141ca1a1c36a': 'VRSC',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  '0xe6052dcc60573561ecef2d9a4c0fea6d3ac5b9a2': 'BRIDGE',
  '0x68749665ff8d2d112fa859aa293f07a622782f38': 'XAUT',
  'i3f7tsctfkippiedy8qr5tep9p4qdvebdx': 'BRIDGE',
  'i61cv2uicksi1rsmqcbnqesyc3uai9gvzd': 'USDC',
  'i9kvwku2vwaralpbxn4rs9zvrhvnrauibb': 'KAIJU',
  'i9nlsk4s1u5svmq4ejuhr1gbfalz56j9lj': 'SCRVUSD',
  'i9ocsqkalwjtcv49xuks2u2i79h1kx6ney': 'USDT',
  'is8tfrpfvpko5fvfsuzfhbqxo9kuzpnqlu': 'TBTC',
  'ic5tqfrfxsylqgkiz8fymzhfjzarf5cyge': 'EURC',
  'iexbjfzyk7kredpuhj6pzzbzqmakafg7d2': 'VARRR',
  'igbs4dwztrnvnejbt4mqhszlxfktnhtkhm': 'DAI',
  'ihax5qyqgbcmgqjkkrporpzubx2offxgny': 'PURE',
  'ij3wzocnjg9ufv7gkua4lijqno5gtmb7tp': 'CHIPS'
};

const knownEthereumMetadata = {
  [GLOBAL_ADDRESS.BETH.toLowerCase()]: { name: 'VBRID', symbol: 'VBRID' },
  [GLOBAL_ADDRESS.DAI.toLowerCase()]: { name: 'Dai Stablecoin', symbol: 'DAI' },
  [GLOBAL_ADDRESS.ETH.toLowerCase()]: { name: 'Ethereum', symbol: 'ETH' },
  [GLOBAL_ADDRESS.MKR.toLowerCase()]: { name: 'Maker', symbol: 'MKR' },
  [GLOBAL_ADDRESS.VRSC.toLowerCase()]: { name: 'Verus', symbol: 'VRSC' }
};

const knownVerusMetadata = {
  [GLOBAL_ADDRESS.BETH.toLowerCase()]: { name: 'Bridge.vETH', symbol: 'Bridge.vETH' },
  [GLOBAL_ADDRESS.DAI.toLowerCase()]: { name: 'Dai Stablecoin', symbol: 'DAI.vETH' },
  [GLOBAL_ADDRESS.ETH.toLowerCase()]: { name: 'Ethereum', symbol: 'vETH' },
  [GLOBAL_ADDRESS.MKR.toLowerCase()]: { name: 'Maker', symbol: 'MKR.vETH' },
  [GLOBAL_ADDRESS.VRSC.toLowerCase()]: { name: 'Verus', symbol: bridgeBlockName }
};

const isSameAddress = (left, right) => (
  (left || '').toLowerCase() === (right || '').toLowerCase()
);

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const normalizeCurrencyAddress = (value) => (value || '').trim().toLowerCase();

const normalizeCurrencySymbol = (value) => (value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

const getKnownMetadata = (metadataMap, token) => uniqueValues([
  token?.value,
  token?.iaddress,
  token?.address,
  token?.erc20address
])
  .map((value) => metadataMap[normalizeCurrencyAddress(value)])
  .find(Boolean);

const getKnownEthereumMetadata = (token) => getKnownMetadata(knownEthereumMetadata, token);
const getKnownVerusMetadata = (token) => getKnownMetadata(knownVerusMetadata, token);

const getIconKeyFromAddress = (value) => addressIconAliases[normalizeCurrencyAddress(value)];

const getIconKeyFromSymbol = (value) => symbolIconAliases[normalizeCurrencySymbol(value)];

const extractMappedTokenName = (tokenName) => {
  if (!tokenName) {
    return '';
  }

  const match = tokenName.match(/^\[([^\]]+)\]\s+as\s+/i);
  if (!match) {
    return tokenName;
  }

  const extractedName = match[1].trim();
  return extractedName.startsWith('0x') ? '' : extractedName;
};

const extractMappedVerusSymbol = (tokenName) => {
  if (!tokenName) {
    return '';
  }

  const mappedSymbolMatch = tokenName.match(/\bas\s+(.+)$/i);
  if (mappedSymbolMatch) {
    return mappedSymbolMatch[1].trim();
  }

  if (tokenName === bridgeBlockName || tokenName.endsWith('.vETH') || /^v[A-Za-z0-9]/.test(tokenName)) {
    return tokenName;
  }

  return '';
};

const isEthereumToken = (token) => {
  if (!token) {
    return false;
  }

  if (getKnownEthereumMetadata(token)?.symbol === 'ETH') {
    return true;
  }

  return normalizeCurrencySymbol(token.ethereumSymbol || token.ticker) === 'ETH' && (
    normalizeCurrencyAddress(token.erc20address) === ZERO_ADDRESS ||
    isSameAddress(token.value, GLOBAL_ADDRESS.ETH) ||
    isSameAddress(token.iaddress, GLOBAL_IADDRESS.ETH)
  );
};

const isBridgeToken = (token) => Boolean(token) && (
  isSameAddress(token.value, GLOBAL_ADDRESS.BETH) ||
  isSameAddress(token.erc20address, GLOBAL_ADDRESS.BETH) ||
  token.name === 'Bridge.vETH'
);

const getCurrencyIconKey = (currency) => {
  if (!currency) {
    return null;
  }

  if (typeof currency === 'string') {
    return getIconKeyFromAddress(currency) || getIconKeyFromSymbol(currency);
  }

  const addressMatch = uniqueValues([
    currency.value,
    currency.iaddress,
    currency.address,
    currency.erc20address
  ])
    .map((value) => getIconKeyFromAddress(value))
    .find(Boolean);

  if (addressMatch) {
    return addressMatch;
  }

  if (isBridgeToken(currency)) {
    return 'BRIDGE';
  }

  return getIconKeyFromSymbol(
    currency.symbol || currency.ethereumSymbol || currency.ticker || currency.name
  );
};

export const getCurrencyIcon = (currency) => {
  const iconKey = getCurrencyIconKey(currency);
  return iconMap[iconKey] || PLACEHOLDER_ICON;
};

export const formatCompactAddress = (address) => {
  if (!address || address.length <= 10) {
    return address || '';
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatCurrencyBalance = (value) => {
  const parsedValue = parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return '--';
  }

  if (parsedValue > 0 && parsedValue < 0.001) {
    return '<0.001';
  }

  return Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3
  }).format(parsedValue);
};

export const formatCurrencyFiat = (value) => {
  const parsedValue = parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return null;
  }

  if (parsedValue > 0 && parsedValue < 0.01) {
    return '<$0.01';
  }

  return usdFormatter.format(parsedValue);
};

export const getTokenDisplaySymbol = (token) => {
  if (!token) {
    return '';
  }

  const knownMetadata = getKnownEthereumMetadata(token);
  if (knownMetadata?.symbol) {
    return knownMetadata.symbol;
  }

  return token.ethereumSymbol || token.ticker || token.name || '';
};

export const getTokenDisplayName = (token) => {
  if (!token) {
    return '';
  }

  const knownMetadata = getKnownEthereumMetadata(token);
  if (knownMetadata?.name) {
    return knownMetadata.name;
  }

  if (isBridgeToken(token)) {
    return token.ethereumSymbol || 'VBRID';
  }

  return token.ethereumName || extractMappedTokenName(token.name) || getTokenDisplaySymbol(token);
};

export const getTokenVerusSymbol = (token) => {
  if (!token) {
    return '';
  }

  const knownMetadata = getKnownVerusMetadata(token);
  if (knownMetadata?.symbol) {
    return knownMetadata.symbol;
  }

  return extractMappedVerusSymbol(token.name) || token.name || token.ticker || getTokenDisplaySymbol(token);
};

export const getTokenVerusName = (token) => {
  if (!token) {
    return '';
  }

  const knownMetadata = getKnownVerusMetadata(token);
  if (knownMetadata?.name) {
    return knownMetadata.name;
  }

  return getTokenDisplayName(token) || extractMappedTokenName(token.name) || extractMappedVerusSymbol(token.name) || token.name || getTokenDisplaySymbol(token);
};

const getTokenSearchTerms = (token) => uniqueValues([
  getTokenDisplayName(token),
  getTokenDisplaySymbol(token),
  token?.ethereumName,
  token?.ethereumSymbol,
  token?.name,
  token?.ticker,
  isEthereumToken(token) ? null : token?.erc20address
]);

const getSourceCurrencySortKey = (currency) => (
  getIconKeyFromAddress(currency?.address) ||
  getIconKeyFromAddress(currency?.id) ||
  getIconKeyFromSymbol(currency?.symbol) ||
  getIconKeyFromSymbol(currency?.name) ||
  normalizeCurrencySymbol(currency?.symbol || currency?.name)
);

const getSourceCurrencySortLabel = (currency) => currency?.name || currency?.symbol || '';

export const isPopularSourceCurrency = (currency) => (
  POPULAR_SOURCE_CURRENCY_KEY_SET.has(getSourceCurrencySortKey(currency))
);

export const getSourceCurrencySections = (currencies) => {
  const popular = [];
  const others = [];

  currencies.forEach((currency) => {
    if (isPopularSourceCurrency(currency)) {
      popular.push(currency);
      return;
    }

    others.push(currency);
  });

  return [
    popular.length ? { id: 'popular', label: 'Popular', currencies: popular } : null,
    others.length ? { id: 'others', label: 'Others', currencies: others } : null
  ].filter(Boolean);
};

export const buildTokenCurrency = (token, metadata = {}) => ({
  id: token.value,
  symbol: getTokenDisplaySymbol(token),
  name: getTokenDisplayName(token),
  icon: getCurrencyIcon(token),
  address: isEthereumToken(token) ? undefined : token.erc20address,
  searchTerms: getTokenSearchTerms(token),
  ...metadata
});

export const sortSourceCurrencies = (currencies) => [...currencies].sort((left, right) => {
  const leftPriority = POPULAR_SOURCE_CURRENCY_KEYS.indexOf(getSourceCurrencySortKey(left));
  const rightPriority = POPULAR_SOURCE_CURRENCY_KEYS.indexOf(getSourceCurrencySortKey(right));

  if (leftPriority !== -1 || rightPriority !== -1) {
    if (leftPriority === -1) {
      return 1;
    }

    if (rightPriority === -1) {
      return -1;
    }

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
  }

  const nameComparison = getSourceCurrencySortLabel(left).localeCompare(
    getSourceCurrencySortLabel(right),
    undefined,
    { sensitivity: 'base' }
  );

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return (left?.id || '').localeCompare(right?.id || '', undefined, { sensitivity: 'base' });
});

export const buildDestinationCurrency = (destinationOption, selectedToken) => {
  const { value } = destinationOption;
  const verusMetadata = getKnownVerusMetadata({ value: destinationOption.iaddress });
  const ethereumMetadata = getKnownEthereumMetadata({ value: destinationOption.iaddress });

  if (value === BLOCKCHAIN_NAME) {
    const tokenSymbol = getTokenVerusSymbol(selectedToken) || bridgeBlockName;

    return {
      id: value,
      symbol: tokenSymbol,
      name: getTokenVerusName(selectedToken) || bridgeBlockName,
      icon: getCurrencyIcon(selectedToken || tokenSymbol)
    };
  }

  if (value.startsWith('swapto')) {
    return {
      id: value,
      symbol: ethereumMetadata?.symbol || bridgeBlockName,
      name: ethereumMetadata?.name || bridgeBlockName,
      icon: getCurrencyIcon({ value: destinationOption.iaddress, symbol: ethereumMetadata?.symbol || bridgeBlockName })
    };
  }

  if (verusMetadata) {
    return {
      id: value,
      symbol: verusMetadata.symbol,
      name: verusMetadata.name,
      icon: getCurrencyIcon({ value: destinationOption.iaddress, symbol: verusMetadata.symbol })
    };
  }

  return {
    id: value,
    symbol: bridgeBlockName,
    name: bridgeBlockName,
    icon: getCurrencyIcon({ value: destinationOption.iaddress, symbol: bridgeBlockName })
  };
};
