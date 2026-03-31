import { BLOCKCHAIN_NAME, GLOBAL_ADDRESS } from 'constants/contractAddress';

const iconMap = {
  BRIDGE: '/icons/currencies/bridgeveth.svg',
  BETH: '/icons/currencies/bridgeveth.svg',
  DAI: '/icons/currencies/dai.svg',
  ETH: '/icons/currencies/eth.png',
  EURC: '/icons/currencies/eurc.svg',
  KAU: '/icons/currencies/kaiju.svg',
  MKR: '/icons/currencies/mkr.png',
  PURE: '/icons/currencies/pure.svg',
  SCRVUSD: '/icons/currencies/scrvUSD.svg',
  TBTC: '/icons/currencies/tbtc.svg',
  USDC: '/icons/currencies/usdc.svg',
  USDT: '/icons/currencies/usdt.svg',
  VRSC: '/icons/currencies/verus-icon-blue.svg',
  VRSCTEST: '/icons/currencies/verus-icon-blue.svg'
};

const bridgeBlockName = BLOCKCHAIN_NAME.toUpperCase();

const knownEthereumMetadata = {
  [GLOBAL_ADDRESS.BETH.toLowerCase()]: { name: 'VBRID', symbol: 'VBRID' },
  [GLOBAL_ADDRESS.DAI.toLowerCase()]: { name: 'Dai Stablecoin', symbol: 'DAI' },
  [GLOBAL_ADDRESS.ETH.toLowerCase()]: { name: 'Ethereum', symbol: 'ETH' },
  [GLOBAL_ADDRESS.MKR.toLowerCase()]: { name: 'Maker', symbol: 'MKR' }
};

const isSameAddress = (left, right) => (
  (left || '').toLowerCase() === (right || '').toLowerCase()
);

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const getKnownEthereumMetadata = (token) => knownEthereumMetadata[(token?.value || '').toLowerCase()];

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

const isBridgeToken = (token) => Boolean(token) && (
  isSameAddress(token.value, GLOBAL_ADDRESS.BETH) ||
  isSameAddress(token.erc20address, GLOBAL_ADDRESS.BETH) ||
  token.name === 'Bridge.vETH'
);

export const getCurrencyIcon = (symbol) => {
  const normalizedSymbol = (symbol || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return iconMap[normalizedSymbol] || '/icons/currencies/placeholder.svg';
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

const getTokenSearchTerms = (token) => uniqueValues([
  getTokenDisplayName(token),
  getTokenDisplaySymbol(token),
  token?.ethereumName,
  token?.ethereumSymbol,
  token?.name,
  token?.ticker,
  token?.erc20address
]);

export const buildTokenCurrency = (token) => ({
  id: token.value,
  symbol: getTokenDisplaySymbol(token),
  name: getTokenDisplayName(token),
  icon: getCurrencyIcon(isBridgeToken(token) ? 'BRIDGE' : getTokenDisplaySymbol(token)),
  address: token.erc20address,
  searchTerms: getTokenSearchTerms(token)
});

export const buildDestinationCurrency = (destinationOption, selectedToken) => {
  const { value } = destinationOption;

  if (value === BLOCKCHAIN_NAME) {
    return {
      id: value,
      symbol: selectedToken?.ticker || bridgeBlockName,
      name: `${selectedToken?.name || bridgeBlockName} on ${bridgeBlockName}`,
      icon: getCurrencyIcon(selectedToken?.ticker || bridgeBlockName)
    };
  }

  if (value.includes('BRIDGE')) {
    return {
      id: value,
      symbol: 'BRIDGE',
      name: 'Bridge.vETH',
      icon: getCurrencyIcon('BRIDGE')
    };
  }

  if (value.includes('DAI')) {
    return {
      id: value,
      symbol: 'DAI',
      name: 'DAI',
      icon: getCurrencyIcon('DAI')
    };
  }

  if (value.includes('ETH')) {
    return {
      id: value,
      symbol: 'ETH',
      name: 'Ethereum',
      icon: getCurrencyIcon('ETH')
    };
  }

  if (value.includes('MKR')) {
    return {
      id: value,
      symbol: 'MKR',
      name: 'Maker',
      icon: getCurrencyIcon('MKR')
    };
  }

  return {
    id: value,
    symbol: bridgeBlockName,
    name: bridgeBlockName,
    icon: getCurrencyIcon(bridgeBlockName)
  };
};
