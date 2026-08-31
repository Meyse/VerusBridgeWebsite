import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';
import { Wallet, utils } from 'ethers';

import { useToast } from 'components/Toast/ToastProvider';
import {
  BLOCKCHAIN_NAME,
  ETHEREUM_BLOCKCHAIN_NAME,
  EXPECTED_ETHEREUM_CHAIN_ID,
  GLOBAL_ADDRESS,
  GLOBAL_IADDRESS,
  HEIGHT_LOCATION_IN_FORKS,
  TESTNET
} from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { getContract, getMaxAmount } from 'utils/contract';
import { convertVerusAddressToEthAddress } from 'utils/convert';
import {
  REFUND_ADDRESS_SIGNATURE_STATUS_KEY,
  REFUND_ADDRESS_STORAGE_KEY
} from 'utils/refundAddress';
import { hash160, toBase58Check } from 'utils/verusAddress';

import useBridgeController from './useBridgeController';

const { mockVerusd } = vi.hoisted(() => ({
  mockVerusd: {
    estimateConversion: vi.fn(),
    getBlock: vi.fn(),
    getCurrency: vi.fn(),
    getIdentity: vi.fn(),
    getInfo: vi.fn()
  }
}));

vi.mock('@web3-react/core', () => ({
  useWeb3React: vi.fn()
}));

vi.mock('components/Toast/ToastProvider', () => ({
  useToast: vi.fn()
}));

vi.mock('hooks/useContract', () => ({ default: vi.fn() }));

vi.mock('utils/verusdRpc', () => ({
  VerusdRpcInterface: vi.fn(function MockVerusdRpcInterface() {
    return mockVerusd;
  })
}));

vi.mock('utils/contract', () => ({
  getContract: vi.fn(),
  getMaxAmount: vi.fn()
}));

const ETH_ADDRESS = GLOBAL_ADDRESS.ETH;
const DAI_ADDRESS = GLOBAL_ADDRESS.DAI;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const LINK_ADDRESS = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
const EURC_ADDRESS = '0x1AbAAE1F7c830bD89Acc67ec4af516284b1bC33c';
const SCRVUSD_ADDRESS = '0x1111111111111111111111111111111111111111';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TBTC_ADDRESS = '0x18084fbA666A33d37592fA2633fD49A74dD93a88';
const originalFetch = global.fetch;
const REFUND_ADDRESS_MESSAGE = 'Agreeing to this will create a public key address for Verus Refunds.';
const VALID_REFUND_ADDRESS = toBase58Check(Buffer.alloc(20, 1), 60);
const directRouteLabel = `${ETHEREUM_BLOCKCHAIN_NAME} -> ${TESTNET ? BLOCKCHAIN_NAME : 'Verus'}`;
const bouncebackRouteLabel = `${directRouteLabel} -> ${ETHEREUM_BLOCKCHAIN_NAME}`;

const liveEthToken = {
  name: 'vETH',
  ticker: 'ETH',
  iaddress: ETH_ADDRESS,
  erc20ContractAddress: ZERO_ADDRESS,
  flags: '9'
};

const daiToken = {
  name: 'DAI.vETH',
  ticker: 'DAI',
  iaddress: DAI_ADDRESS,
  erc20ContractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  flags: '12'
};

const eurcToken = {
  name: 'EURC.vETH',
  ticker: 'EURC',
  iaddress: EURC_ADDRESS,
  erc20ContractAddress: EURC_ADDRESS,
  flags: '12'
};

const scrvusdToken = {
  name: 'scrvUSD.vETH',
  ticker: 'scrvUSD',
  iaddress: SCRVUSD_ADDRESS,
  erc20ContractAddress: SCRVUSD_ADDRESS,
  flags: '12'
};

const usdtToken = {
  name: 'vUSDT.vETH',
  ticker: 'USDT',
  iaddress: USDT_ADDRESS,
  erc20ContractAddress: USDT_ADDRESS,
  flags: '12'
};

const tbtcToken = {
  name: 'tBTC.vETH',
  ticker: 'tBTC',
  iaddress: TBTC_ADDRESS,
  erc20ContractAddress: TBTC_ADDRESS,
  flags: '12'
};

const linkToken = {
  name: 'LINK.vETH',
  ticker: 'LINK',
  iaddress: LINK_ADDRESS,
  erc20ContractAddress: LINK_ADDRESS,
  flags: '12'
};

const createCurrencyResult = ({ currencyId = 'market-id', namesById, reserveEntries, supply = 100 }) => ({
  result: {
    bestcurrencystate: {
      reservecurrencies: reserveEntries,
      supply
    },
    currencyid: currencyId,
    currencynames: namesById
  }
});

const createBridgeCurrencyResult = () => createCurrencyResult({
  currencyId: 'bridge-market-id',
  namesById: {
    'bridge-vrsc': 'VRSC',
    'bridge-dai': 'DAI.vETH',
    'bridge-mkr': 'MKR.vETH',
    'bridge-eth': 'vETH'
  },
  reserveEntries: [
    { currencyid: 'bridge-vrsc', priceinreserve: 15, reserves: 1500, weight: 0.25 },
    { currencyid: 'bridge-dai', priceinreserve: 10, reserves: 250, weight: 0.25 },
    { currencyid: 'bridge-mkr', priceinreserve: 0.005, reserves: 20, weight: 0.25 },
    { currencyid: 'bridge-eth', priceinreserve: 0.01, reserves: 25, weight: 0.25 }
  ],
  supply: 100
});

const createFloralisCurrencyResult = () => createCurrencyResult({
  currencyId: 'floralis-market-id',
  namesById: {
    'floralis-dai': 'DAI.vETH',
    'floralis-usdt': 'vUSDT.vETH',
    'floralis-eurc': 'EURC.vETH',
    'floralis-scrvusd': 'scrvUSD.vETH',
    'floralis-tbtc': 'tBTC.vETH'
  },
  reserveEntries: [
    { currencyid: 'floralis-dai', priceinreserve: 20, reserves: 1000, weight: 0.125 },
    { currencyid: 'floralis-usdt', priceinreserve: 20.4, reserves: 980, weight: 0.125 },
    { currencyid: 'floralis-eurc', priceinreserve: 16, reserves: 800, weight: 0.05 },
    { currencyid: 'floralis-scrvusd', priceinreserve: 18, reserves: 720, weight: 0.05 },
    { currencyid: 'floralis-tbtc', priceinreserve: 0.0005, reserves: 0.5, weight: 0.2 }
  ],
  supply: 100
});

const createNatiCurrencyResult = () => createCurrencyResult({
  currencyId: 'nati-market-id',
  namesById: {
    'nati-vrsc': 'VRSC',
    'nati-eth': 'vETH'
  },
  reserveEntries: [
    { currencyid: 'nati-vrsc', priceinreserve: 28.84, reserves: 2884, weight: 0.25 },
    { currencyid: 'nati-eth', priceinreserve: 0.01, reserves: 10, weight: 0.25 }
  ],
  supply: 100
});

const createLibrary = (overrides = {}) => ({
  getBalance: vi.fn().mockResolvedValue('0'),
  getBlock: vi.fn(() => new Promise(() => {})),
  getBlockNumber: vi.fn(() => new Promise(() => {})),
  getCode: vi.fn().mockResolvedValue('0x60006000'),
  getNetwork: vi.fn().mockResolvedValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID }),
  getTransaction: vi.fn(() => new Promise(() => {})),
  ...overrides
});

const createDelegatorContract = (overrides = {}) => {
  const { callStatic: callStaticOverrides = {}, ...contractOverrides } = overrides;

  return {
    callStatic: {
      bestForks: vi.fn(() => new Promise(() => {})),
      bridgeConverterActive: vi.fn().mockResolvedValue(true),
      getTokenList: vi.fn().mockResolvedValue([liveEthToken, daiToken]),
      verusToERC20mapping: vi.fn().mockResolvedValue({ flags: '1' }),
      ...callStaticOverrides
    },
    ...contractOverrides
  };
};

const createDeferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
};

const readJsonTestId = (testId) => JSON.parse(screen.getByTestId(testId).textContent || '{}');
const createBestForksData = (height) => (
  `${'0'.repeat(HEIGHT_LOCATION_IN_FORKS)}${height.toString(16).padStart(8, '0')}`
);

const cacheRefundAddress = (account = '0xabc') => {
  window.localStorage.setItem(REFUND_ADDRESS_STORAGE_KEY, JSON.stringify({
    [account]: VALID_REFUND_ADDRESS
  }));
};

const getRefundAddressFromSignature = (signature) => {
  const messageHash = utils.hashMessage(REFUND_ADDRESS_MESSAGE);
  const publicKey = utils.recoverPublicKey(utils.arrayify(messageHash), signature);
  const compressedPublicKey = utils.computePublicKey(publicKey, true);

  return toBase58Check(
    hash160(Buffer.from(compressedPublicKey.slice(2), 'hex')),
    60
  );
};

const HookProbe = ({ controllerOptions = {} }) => {
  const controller = useBridgeController(controllerOptions);

  return (
    <div>
      <div data-testid="catalog-error">{controller.sourceCatalogError || ''}</div>
      <div data-testid="catalog-loading">{controller.isSourceCatalogLoading ? 'loading' : 'ready'}</div>
      <div data-testid="selected-flags">{controller.selectedToken?.flags || ''}</div>
      <div data-testid="selected-value">{controller.selectedToken?.value || ''}</div>
      <div data-testid="allows-ethereum-destination">{controller.allowsEthereumDestination ? 'yes' : 'no'}</div>
      <div data-testid="address-hint">{controller.addressHint || ''}</div>
      <div data-testid="address-error">{controller.addressError || ''}</div>
      <div data-testid="address-resolution">{controller.addressResolutionMessage || ''}</div>
      <div data-testid="alert-message">{controller.alert?.message || ''}</div>
      <div data-testid="destination-count">{controller.destinationOptions.length}</div>
      <div data-testid="source-count">{controller.sourceCurrencies.length}</div>
      <div data-testid="source-symbols">{controller.sourceCurrencies.map((currency) => currency.symbol).join(',')}</div>
      <div data-testid="source-fiat-values">{controller.sourceCurrencies.map((currency) => `${currency.symbol}:${currency.fiatLabel || 'none'}`).join('|')}</div>
      <div data-testid="token-flags">{controller.tokenOptions.map((token) => `${token.value}:${token.flags || ''}`).join('|')}</div>
      <div data-testid="amount">{controller.amount || ''}</div>
      <div data-testid="amount-fiat">{controller.amountFiatLabel || ''}</div>
      <div data-testid="receive-fiat">{controller.receiveFiatLabel || ''}</div>
      <div data-testid="receive-symbol">{controller.receiveCurrency?.symbol || ''}</div>
      <div data-testid="receive-amount">{controller.receiveAmountDisplay || ''}</div>
      <div data-testid="receive-quote-state">{controller.receiveQuoteState || ''}</div>
      <div data-testid="send-amount-presets">{JSON.stringify(controller.sendAmountPresets || [])}</div>
      <div data-testid="send-amount-preset-warning">{controller.sendAmountPresetWarningMessage || ''}</div>
      <div data-testid="warning-kind">{controller.conversionWarningKind || ''}</div>
      <div data-testid="warning-gap">{controller.conversionWarningGapPercent || ''}</div>
      <div data-testid="warning-message">{controller.conversionWarningMessage || ''}</div>
      <div data-testid="eth-usd-price">{controller.ethUsdPrice || ''}</div>
      <div data-testid="price-source-map">{JSON.stringify(controller.priceSourceBySymbol || {})}</div>
      <div data-testid="usd-price-map">{JSON.stringify(controller.usdPriceBySymbol || {})}</div>
      <div data-testid="has-fresh-receive-quote">{controller.hasFreshReceiveQuote ? 'yes' : 'no'}</div>
      <div data-testid="has-review-snapshot">{controller.hasReviewSnapshot ? 'yes' : 'no'}</div>
      <div data-testid="can-submit">{controller.canSubmit ? 'yes' : 'no'}</div>
      <div data-testid="submit-disabled-reason">{controller.submitDisabledReason || ''}</div>
      <div data-testid="refund-signature-pending">{controller.isRefundSignaturePending ? 'yes' : 'no'}</div>
      <div data-testid="is-reviewing">{controller.isReviewing ? 'yes' : 'no'}</div>
      <div data-testid="review-confirm-label">{controller.reviewConfirmLabel || ''}</div>
      <div data-testid="can-confirm-review">{controller.canConfirmReview ? 'yes' : 'no'}</div>
      <div data-testid="review-bounceback-warning">{controller.reviewBouncebackWarningMessage || ''}</div>
      <div data-testid="review-exchange-rate-primary">{controller.reviewExchangeRate?.primary ? `${controller.reviewExchangeRate.primary.label}|${controller.reviewExchangeRate.primary.fiatLabel || ''}` : ''}</div>
      <div data-testid="review-exchange-rate-inverse">{controller.reviewExchangeRate?.inverse ? `${controller.reviewExchangeRate.inverse.label}|${controller.reviewExchangeRate.inverse.fiatLabel || ''}` : ''}</div>
      <div data-testid="review-route-label">{controller.reviewRouteLabel || ''}</div>
      <div data-testid="review-time-estimate">{controller.reviewTimeEstimate || ''}</div>
      <div data-testid="review-destination-address">{controller.reviewDestinationAddress || ''}</div>
      <div data-testid="review-destination-identity">{controller.reviewDestinationIdentityName || ''}</div>
      <div data-testid="review-fees">{(controller.reviewFeeRows || []).map((row) => `${row.label}:${row.value}`).join('|')}</div>
      <div data-testid="base-fee">{controller.baseBridgeFeeValue ?? ''}</div>
      <div data-testid="bounceback-fee">{controller.bounceBackFeeValue ?? ''}</div>
      <div data-testid="notarization-height">{controller.verusChainHeight ?? ''}</div>
      <div data-testid="notarization-lag-seconds">{controller.notarizationLagSeconds ?? ''}</div>
      <div data-testid="verus-tip-height">{controller.verusTipHeight ?? ''}</div>
      <div data-testid="token-balance-label">{controller.tokenBalanceLabel || ''}</div>
      <button
        onClick={() => {
          controller.selectToken(DAI_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2.290298377929176');
        }}
        type="button"
      >
        Configure Direct DAI
      </button>
      <button
        onClick={() => {
          controller.selectToken(DAI_ADDRESS);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2.290298377929176');
          controller.selectDestination('bridgeETH');
        }}
        type="button"
      >
        Configure Bridge ETH
      </button>
      <button
        onClick={() => {
          controller.selectToken(DAI_ADDRESS);
          controller.setAmount('0.322832');
        }}
        type="button"
      >
        Configure DAI No Destination
      </button>
      <button
        onClick={() => {
          controller.selectToken(DAI_ADDRESS);
          controller.selectDestination('swaptoETH');
          controller.setAddress('0x1111111111111111111111111111111111111111');
          controller.setAmount('2');
        }}
        type="button"
      >
        Configure Swap
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.selectDestination('swaptoDAI');
          controller.setAddress('0x1111111111111111111111111111111111111111');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure ETH Swap DAI
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure ETH Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.setAddress('Max@');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure VerusID Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(DAI_ADDRESS);
          controller.setAddress('Max@');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure VerusID ERC20 Direct
      </button>
      <button onClick={() => controller.selectDestination(BLOCKCHAIN_NAME)} type="button">
        Select Verus Destination
      </button>
      <button
        onClick={() => {
          controller.setAmount('3');
        }}
        type="button"
      >
        Change Amount
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.selectDestination('bridgeVRSC');
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure ETH Bridge VRSC
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.selectDestination('bridgeDAI');
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure ETH Bridge DAI
      </button>
      <button
        onClick={() => {
          controller.selectToken(ETH_ADDRESS);
          controller.selectDestination('bridgeMKR');
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('1');
        }}
        type="button"
      >
        Configure ETH Bridge MKR
      </button>
      <button
        onClick={() => {
          controller.selectToken(EURC_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2');
        }}
        type="button"
      >
        Configure EURC Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(SCRVUSD_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2');
        }}
        type="button"
      >
        Configure scrvUSD Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(USDT_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2');
        }}
        type="button"
      >
        Configure USDT Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(TBTC_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('0.1');
        }}
        type="button"
      >
        Configure tBTC Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(LINK_ADDRESS);
          controller.selectDestination(BLOCKCHAIN_NAME);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('2');
        }}
        type="button"
      >
        Configure LINK Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(EURC_ADDRESS);
          controller.setAddress('iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv');
          controller.setAmount('5');
        }}
        type="button"
      >
        Configure EURC Auto Direct
      </button>
      <button
        onClick={() => {
          controller.selectToken(EURC_ADDRESS);
          controller.setAmount('5');
        }}
        type="button"
      >
        Configure EURC Auto Direct No Address
      </button>
      <button onClick={() => controller.handleMaxAmount()} type="button">Trigger Max</button>
      <button onClick={() => controller.openReview()} type="button">Open Review</button>
      <button onClick={() => controller.handleSubmit()} type="button">Submit Transfer</button>
      <button onClick={() => controller.closeReview()} type="button">Close Review</button>
    </div>
  );
};

describe('useBridgeController disconnected source bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete window.ethereum;

    global.fetch = vi.fn(() => new Promise(() => {}));
    useToast.mockReturnValue({ addToast: vi.fn() });
    getMaxAmount.mockResolvedValue(100);
    const tokenMetadataByAddress = {
      [daiToken.erc20ContractAddress.toLowerCase()]: { decimals: 18, name: 'Dai Stablecoin', symbol: 'DAI' },
      [eurcToken.erc20ContractAddress.toLowerCase()]: { decimals: 6, name: 'Euro Coin', symbol: 'EURC' },
      [scrvusdToken.erc20ContractAddress.toLowerCase()]: { decimals: 18, name: 'Savings crvUSD', symbol: 'scrvUSD' },
      [usdtToken.erc20ContractAddress.toLowerCase()]: { decimals: 6, name: 'Tether USD', symbol: 'USDT' },
      [tbtcToken.erc20ContractAddress.toLowerCase()]: { decimals: 18, name: 'tBTC', symbol: 'tBTC' },
      [linkToken.erc20ContractAddress.toLowerCase()]: { decimals: 18, name: 'Chainlink', symbol: 'LINK' }
    };
    getContract.mockImplementation((address) => ({
      decimals: vi.fn().mockResolvedValue(tokenMetadataByAddress[address?.toLowerCase()]?.decimals || 18),
      name: vi.fn().mockResolvedValue(tokenMetadataByAddress[address?.toLowerCase()]?.name || 'Token'),
      symbol: vi.fn().mockResolvedValue(tokenMetadataByAddress[address?.toLowerCase()]?.symbol || 'TKN')
    }));
    mockVerusd.getBlock.mockResolvedValue(null);
    mockVerusd.getCurrency.mockImplementation((currencyName) => {
      switch (currencyName) {
        case 'bridge.veth':
          return Promise.resolve(createBridgeCurrencyResult());
        case 'Floralis':
          return Promise.resolve(createFloralisCurrencyResult());
        case 'NATI🦉':
          return Promise.resolve(createNatiCurrencyResult());
        default:
          return Promise.resolve({});
      }
    });
    mockVerusd.getInfo.mockResolvedValue({
      result: {
        longestchain: 100,
        tiptime: 1000
      }
    });
    mockVerusd.getIdentity.mockResolvedValue({});
    mockVerusd.estimateConversion.mockResolvedValue({});
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('blocks review when the connected wallet is on a different chain', async () => {
    const wrongChainId = EXPECTED_ETHEREUM_CHAIN_ID === 1 ? 11155111 : 1;
    const library = createLibrary();

    useWeb3React.mockReturnValue({ account: '0xabc', chainId: wrongChainId, library });
    useContract.mockReturnValue(createDelegatorContract());

    render(<HookProbe />);

    expect(screen.getByTestId('submit-disabled-reason')).toHaveTextContent('Switch wallet');
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('alert-message')).toHaveTextContent('Switch MetaMask');
    });
    expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('no');
  });

  test('seeds ETH immediately before async source bootstrap completes', () => {
    const library = createLibrary();
    const delegatorContract = createDelegatorContract({
      callStatic: {
        bridgeConverterActive: vi.fn(() => new Promise(() => {})),
        getTokenList: vi.fn(() => new Promise(() => {}))
      }
    });

    mockVerusd.getCurrency.mockImplementation(() => new Promise(() => {}));
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    expect(screen.getByTestId('selected-value')).toHaveTextContent(ETH_ADDRESS);
    expect(screen.getByTestId('source-count')).toHaveTextContent('1');
    expect(screen.getByTestId('source-symbols')).toHaveTextContent('ETH');
    expect(screen.getByTestId('catalog-loading')).toHaveTextContent('loading');
  });

  test('keeps source tokens available when gas estimation fails', async () => {
    const library = createLibrary({
      getBlockNumber: vi.fn().mockRejectedValue(new Error('gas rpc down'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('selected-value')).toHaveTextContent(ETH_ADDRESS);
    expect(screen.getByTestId('source-count')).toHaveTextContent('2');
    expect(screen.getByTestId('source-symbols')).toHaveTextContent('ETH,DAI');
    expect(screen.getByTestId('catalog-error')).toBeEmptyDOMElement();
    expect(Number(screen.getByTestId('base-fee').textContent)).toBeCloseTo(0.003, 6);
    expect(Number(screen.getByTestId('bounceback-fee').textContent)).toBeCloseTo(0.013, 6);
  });

  test('uses the minimum gateway fee floor in swap fee rows when live gas is unavailable', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockRejectedValue(new Error('gas rpc down'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Swap' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-fees').textContent).toContain('Bridge fee:0.0030 ETH');
    });

    expect(screen.getByTestId('review-fees').textContent).toContain('Network cost:0.010 ETH');
  });

  test('replaces the seeded ETH token with the live ETH token while preserving selection', async () => {
    const library = createLibrary();
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('selected-flags')).toHaveTextContent('9');
    });

    expect(screen.getByTestId('selected-value')).toHaveTextContent(ETH_ADDRESS);
    expect(screen.getByTestId('token-flags').textContent).toContain(`${ETH_ADDRESS}:9`);
    expect(screen.getByTestId('token-flags').textContent).toContain(`${DAI_ADDRESS}:12`);
  });

  test('retries the source catalog once and keeps seeded ETH available after repeated failures', async () => {
    const bridgeConverterActive = vi.fn().mockRejectedValue(new Error('catalog rpc down'));
    const library = createLibrary();
    const delegatorContract = createDelegatorContract({
      callStatic: {
        bridgeConverterActive
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    expect(bridgeConverterActive).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('catalog-error')).toHaveTextContent('Unable to load all currencies right now.');
    expect(screen.getByTestId('selected-value')).toHaveTextContent(ETH_ADDRESS);
    expect(screen.getByTestId('source-count')).toHaveTextContent('1');
    expect(screen.getByTestId('source-symbols')).toHaveTextContent('ETH');
  });

  test('shows DAI.vETH and a 1:1 receive amount for direct Verus sends', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-symbol')).toHaveTextContent('DAI.vETH');
    });

    expect(screen.getByTestId('receive-amount')).toHaveTextContent('2.29029837');
  });

  test('auto-selects the only valid direct Verus route for mapped tokens and shows an immediate 1:1 receive amount', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        getTokenList: vi.fn().mockResolvedValue([liveEthToken, daiToken, eurcToken])
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('source-symbols')).toHaveTextContent('EURC');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure EURC Auto Direct' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-value')).toHaveTextContent(EURC_ADDRESS);
      expect(screen.getByTestId('receive-symbol')).toHaveTextContent('EURC.vETH');
    });

    expect(screen.getByTestId('receive-amount')).toHaveTextContent('5');
    expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('not-required');
    expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
  });

  test('keeps the receive amount blank until a receive currency is selected', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure DAI No Destination' }));

    expect(screen.getByTestId('receive-amount')).toHaveTextContent('--');
    expect(screen.getByTestId('receive-symbol')).toBeEmptyDOMElement();
    expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('not-required');
    expect(screen.getByTestId('submit-disabled-reason')).toHaveTextContent('Select output');
  });

  test('builds ERC20 send amount presets from the full token balance', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('token-balance-label')).toHaveTextContent('100 DAI');
    });

    expect(readJsonTestId('send-amount-presets')).toEqual([
      { amount: '25', id: '25', label: '25%' },
      { amount: '50', id: '50', label: '50%' },
      { amount: '75', id: '75', label: '75%' },
      { amount: '100', id: 'max', label: 'Max' }
    ]);
  });

  test('uses spendable ETH for max and percentage presets', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        verusToERC20mapping: vi.fn().mockResolvedValue({ flags: '0' })
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Direct' }));

    await waitFor(() => {
      expect(screen.getByTestId('token-balance-label')).toHaveTextContent('1 ETH');
    });

    await waitFor(() => {
      expect(readJsonTestId('send-amount-presets')).toEqual([
        { amount: '0.24925', id: '25', label: '25%' },
        { amount: '0.4985', id: '50', label: '50%' },
        { amount: '0.74775', id: '75', label: '75%' },
        { amount: '0.997', id: 'max', label: 'Max' }
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Max' }));

    expect(screen.getByTestId('amount')).toHaveTextContent('0.997');
  });

  test('derives fixed-decimal send amount presets without float drift', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        getTokenList: vi.fn().mockResolvedValue([liveEthToken, daiToken, usdtToken])
      }
    });

    getMaxAmount.mockResolvedValue('1.000003');
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure USDT Direct' }));

    await waitFor(() => {
      expect(screen.getByTestId('token-balance-label')).toHaveTextContent('1.000003 USDT');
    });

    expect(readJsonTestId('send-amount-presets')).toEqual([
      { amount: '0.25', id: '25', label: '25%' },
      { amount: '0.500001', id: '50', label: '50%' },
      { amount: '0.750002', id: '75', label: '75%' },
      { amount: '1.000003', id: 'max', label: 'Max' }
    ]);
  });

  test('returns no send amount presets when ETH is fully consumed by fees', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('0.003'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        verusToERC20mapping: vi.fn().mockResolvedValue({ flags: '0' })
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Direct' }));

    await waitFor(() => {
      expect(screen.getByTestId('token-balance-label')).toHaveTextContent('0.003 ETH');
    });

    expect(readJsonTestId('send-amount-presets')).toEqual([]);
    expect(screen.getByTestId('send-amount-preset-warning')).toHaveTextContent(
      /don't have enough ETH to pay the bridge and network fees/i
    );
  });

  test('exposes the one-way direct Verus route for mapped tokens before any address is entered', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        getTokenList: vi.fn().mockResolvedValue([liveEthToken, daiToken, eurcToken])
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure EURC Auto Direct No Address' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-symbol')).toHaveTextContent('EURC.vETH');
    });

    expect(screen.getByTestId('destination-count')).toHaveTextContent('1');
    expect(screen.getByTestId('receive-amount')).toHaveTextContent('5');
    expect(screen.getByTestId('allows-ethereum-destination')).toHaveTextContent('no');
    expect(screen.getByTestId('address-hint')).toHaveTextContent('Enter a VerusID (such as Max@), R-address, or i-address.');
  });

  test('resolves a VerusID before enabling review and pins its i-address in the review snapshot', async () => {
    const identityAddress = 'iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX';
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('10'))
    });

    mockVerusd.getIdentity.mockResolvedValue({
      result: {
        fullyqualifiedname: 'Max.VRSC@',
        identity: { identityaddress: identityAddress },
        status: 'active'
      }
    });
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(createDelegatorContract());

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure VerusID Direct' }));

    expect(screen.getByTestId('submit-disabled-reason')).toHaveTextContent('Resolving VerusID');

    await waitFor(() => {
      expect(screen.getByTestId('address-resolution')).toHaveTextContent(
        `Max.VRSC@ resolves to ${identityAddress}.`
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select Verus Destination' }));
    await waitFor(() => expect(screen.getByTestId('can-submit')).toHaveTextContent('yes'));

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes'));
    expect(screen.getByTestId('review-destination-identity')).toHaveTextContent('Max.VRSC@');
    expect(screen.getByTestId('review-destination-address')).toHaveTextContent(identityAddress);
  });

  test('re-resolves a VerusID before submitting a transfer to its canonical i-address', async () => {
    const identityAddress = 'iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX';
    const sendTransfer = vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ status: 1 })
    });
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('10'))
    });

    mockVerusd.getIdentity.mockResolvedValue({
      result: {
        fullyqualifiedname: 'Max.VRSC@',
        identity: { identityaddress: identityAddress },
        status: 'active'
      }
    });
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(createDelegatorContract({ sendTransfer }));

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure VerusID Direct' }));
    await waitFor(() => expect(screen.getByTestId('address-resolution')).toHaveTextContent('Max.VRSC@'));
    fireEvent.click(screen.getByRole('button', { name: 'Select Verus Destination' }));
    await waitFor(() => expect(screen.getByTestId('can-submit')).toHaveTextContent('yes'));

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));
    await waitFor(() => expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Transfer' }));

    await waitFor(() => expect(sendTransfer).toHaveBeenCalledTimes(1));
    expect(sendTransfer.mock.calls[0][0].destination).toEqual({
      destinationaddress: convertVerusAddressToEthAddress(identityAddress),
      destinationtype: 4
    });
    expect(mockVerusd.getIdentity).toHaveBeenCalledTimes(2);
    expect(mockVerusd.getIdentity.mock.invocationCallOrder[1])
      .toBeLessThan(sendTransfer.mock.invocationCallOrder[0]);
  });

  test('requires a fresh review when a VerusID resolves to a different address before submission', async () => {
    const reviewedIdentityAddress = 'iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX';
    const changedIdentityAddress = toBase58Check(Buffer.alloc(20, 2), 102);
    const approve = vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ status: 1 })
    });
    const sendTransfer = vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ status: 1 })
    });
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('10'))
    });

    getContract.mockImplementation(() => ({
      approve,
      decimals: vi.fn().mockResolvedValue(18),
      name: vi.fn().mockResolvedValue('Dai Stablecoin'),
      symbol: vi.fn().mockResolvedValue('DAI')
    }));
    mockVerusd.getIdentity
      .mockResolvedValueOnce({
        result: {
          fullyqualifiedname: 'Max.VRSC@',
          identity: { identityaddress: reviewedIdentityAddress },
          status: 'active'
        }
      })
      .mockResolvedValueOnce({
        result: {
          fullyqualifiedname: 'Max.VRSC@',
          identity: { identityaddress: changedIdentityAddress },
          status: 'active'
        }
      });
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(createDelegatorContract({ sendTransfer }));

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure VerusID ERC20 Direct' }));
    await waitFor(() => expect(screen.getByTestId('address-resolution')).toHaveTextContent('Max.VRSC@'));
    fireEvent.click(screen.getByRole('button', { name: 'Select Verus Destination' }));
    await waitFor(() => expect(screen.getByTestId('can-submit')).toHaveTextContent('yes'));

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));
    await waitFor(() => expect(screen.getByTestId('review-destination-address')).toHaveTextContent(
      reviewedIdentityAddress
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Transfer' }));

    await waitFor(() => expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('no'));
    expect(approve).not.toHaveBeenCalled();
    expect(sendTransfer).not.toHaveBeenCalled();
  });

  test('derives internal Bridge and Floralis USD prices while keeping DAI, USDT, and USDC pegged', async () => {
    const library = createLibrary();
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    const usdPriceMap = readJsonTestId('usd-price-map');
    const priceSourceMap = readJsonTestId('price-source-map');

    if (TESTNET) {
      expect(usdPriceMap).toEqual({});
      expect(screen.getByTestId('eth-usd-price')).toBeEmptyDOMElement();
    } else {
      expect(usdPriceMap.DAI).toBe(1);
      expect(usdPriceMap.USDC).toBe(1);
      expect(usdPriceMap.USDT).toBe(1);
      expect(usdPriceMap.BRIDGE).toBeCloseTo(10, 6);
      expect(usdPriceMap.ETH).toBeCloseTo(1000, 6);
      expect(usdPriceMap.MKR).toBeCloseTo(2000, 6);
      expect(usdPriceMap.VRSC).toBeCloseTo(0.666666, 5);
      expect(usdPriceMap.EURC).toBeCloseTo(1.25, 6);
      expect(usdPriceMap.SCRVUSD).toBeCloseTo(1.111111, 5);
      expect(usdPriceMap.TBTC).toBeCloseTo(40000, 6);
      expect(screen.getByTestId('eth-usd-price')).toHaveTextContent('1000');
    }
    expect(priceSourceMap.DAI).toBe('peg');
    expect(priceSourceMap.USDT).toBe('peg');
    expect(priceSourceMap.ETH).toBe('Bridge.vETH');
    expect(priceSourceMap.MKR).toBe('Bridge.vETH');
    expect(priceSourceMap.BRIDGE).toBe('Bridge.vETH');
    expect(priceSourceMap.VRSC).toBe('Bridge.vETH');
    expect(priceSourceMap.EURC).toBe('Floralis');
    expect(priceSourceMap.SCRVUSD).toBe('Floralis');
    expect(priceSourceMap.TBTC).toBe('Floralis');
  });

  test('falls back to block distance when exact notarization block time never responds', async () => {
    vi.useFakeTimers();
    let unmount = () => {};

    try {
      const library = createLibrary();
      const delegatorContract = createDelegatorContract({
        callStatic: {
          bestForks: vi.fn().mockResolvedValue(createBestForksData(98))
        }
      });

      mockVerusd.getBlock.mockReturnValue(new Promise(() => {}));
      mockVerusd.getInfo.mockResolvedValue({
        result: {
          longestchain: 100,
          tiptime: 1000
        }
      });

      useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: null, library });
      useContract.mockReturnValue(delegatorContract);

      ({ unmount } = render(<HookProbe />));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('notarization-lag-seconds')).toBeEmptyDOMElement();

      await act(async () => {
        vi.advanceTimersByTime(8000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('notarization-height')).toHaveTextContent('98');
      expect(screen.getByTestId('verus-tip-height')).toHaveTextContent('100');
      expect(screen.getByTestId('notarization-lag-seconds')).toHaveTextContent('120');
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  test('uses internal spot pricing for EURC, scrvUSD, and tBTC, keeps USDT pegged, and leaves unsupported assets unpriced', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        getTokenList: vi.fn().mockResolvedValue([liveEthToken, daiToken, eurcToken, scrvusdToken, usdtToken, tbtcToken, linkToken])
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('source-symbols')).toHaveTextContent('tBTC');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure EURC Direct' }));
    await waitFor(() => {
      if (TESTNET) {
        expect(screen.getByTestId('amount-fiat')).toBeEmptyDOMElement();
      } else {
        expect(screen.getByTestId('amount-fiat')).toHaveTextContent('$2.50');
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure scrvUSD Direct' }));
    await waitFor(() => {
      if (TESTNET) {
        expect(screen.getByTestId('amount-fiat')).toBeEmptyDOMElement();
      } else {
        expect(screen.getByTestId('amount-fiat')).toHaveTextContent('$2.22');
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure USDT Direct' }));
    await waitFor(() => {
      if (TESTNET) {
        expect(screen.getByTestId('amount-fiat')).toBeEmptyDOMElement();
      } else {
        expect(screen.getByTestId('amount-fiat')).toHaveTextContent('$2.00');
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure tBTC Direct' }));
    await waitFor(() => {
      if (TESTNET) {
        expect(screen.getByTestId('amount-fiat')).toBeEmptyDOMElement();
      } else {
        expect(screen.getByTestId('amount-fiat')).toHaveTextContent('$4,000.00');
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure LINK Direct' }));
    await waitFor(() => {
      expect(screen.getByTestId('amount-fiat')).toBeEmptyDOMElement();
    });
  });

  test('normalizes conversion quote input to Verus eight-decimal precision before requesting a quote', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(mockVerusd.estimateConversion).toHaveBeenCalled();
    });

    expect(mockVerusd.estimateConversion).toHaveBeenLastCalledWith(expect.objectContaining({
      amount: '2.29029837',
      convertto: GLOBAL_IADDRESS.ETH,
      currency: GLOBAL_IADDRESS.DAI,
      via: GLOBAL_IADDRESS.BETH
    }));
  });

  test('uses the vETH reserve target for both bridgeETH and swaptoETH quotes', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });

    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(mockVerusd.estimateConversion).toHaveBeenCalledTimes(1);
    });

    expect(mockVerusd.estimateConversion.mock.calls[0][0].convertto).toBe(GLOBAL_IADDRESS.ETH);

    fireEvent.click(screen.getByRole('button', { name: 'Configure Swap' }));

    await waitFor(() => {
      expect(mockVerusd.estimateConversion).toHaveBeenCalledTimes(2);
    });

    expect(mockVerusd.estimateConversion.mock.calls[1][0].convertto).toBe(GLOBAL_IADDRESS.ETH);
  });

  test('preserves tiny conversion quotes with full precision instead of rounding them down', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('source-symbols')).toHaveTextContent('DAI');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('receive-amount')).toHaveTextContent('0.00107949');
  });

  test('snapshots a reversible conversion exchange rate for review', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    if (!TESTNET) {
      await waitFor(() => {
        expect(screen.getByTestId('eth-usd-price')).toHaveTextContent('1000');
      });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('review-exchange-rate-primary')).toHaveTextContent(
      TESTNET ? '1 vETH = 2121.65 DAI|' : '1 vETH = 2121.65 DAI|$1,000.00'
    );
    expect(screen.getByTestId('review-exchange-rate-inverse')).toHaveTextContent(
      TESTNET ? '1 DAI = 0.00047133 vETH|' : '1 DAI = 0.00047133 vETH|$1.00'
    );
  });

  test('does not warn when an ETH to VRSC quote stays within the 3% threshold', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockImplementation((packet) => {
      if (packet.via === GLOBAL_IADDRESS.BETH && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1490 }
        });
      }

      if (packet.via === 'nati-market-id' && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1495 }
        });
      }

      return Promise.resolve({});
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Bridge VRSC' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('ready');
    });

    await waitFor(() => {
      expect(screen.getByTestId('warning-message')).toBeEmptyDOMElement();
    });

    expect(screen.getByTestId('warning-kind')).toBeEmptyDOMElement();
  });

  test('shows a fiat value for VRSC receive quotes using the Bridge spot price', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockImplementation((packet) => {
      if (packet.via === GLOBAL_IADDRESS.BETH && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1400 }
        });
      }

      if (packet.via === 'nati-market-id' && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1500 }
        });
      }

      return Promise.resolve({});
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Bridge VRSC' }));

    await waitFor(() => {
      if (TESTNET) {
        expect(screen.getByTestId('receive-fiat')).toBeEmptyDOMElement();
      } else {
        expect(screen.getByTestId('receive-fiat')).toHaveTextContent('$933.33');
      }
    });
  });

  test('warns when an ETH to VRSC quote is materially worse than a better available route', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockImplementation((packet) => {
      if (packet.via === GLOBAL_IADDRESS.BETH && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1400 }
        });
      }

      if (packet.via === 'nati-market-id' && packet.convertto === GLOBAL_IADDRESS.VRSC) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 1500 }
        });
      }

      return Promise.resolve({});
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Bridge VRSC' }));

    await waitFor(() => {
      expect(screen.getByTestId('warning-kind')).toHaveTextContent('better-venue');
    });

    expect(screen.getByTestId('warning-gap').textContent).toEqual(expect.stringContaining('7.'));
    expect(screen.getByTestId('warning-message')).toHaveTextContent('below a better currently available route');
  });

  test('warns when an ETH to DAI quote falls below the current spot value', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockImplementation((packet) => {
      if (packet.convertto === GLOBAL_IADDRESS.DAI) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 950 }
        });
      }

      return Promise.resolve({});
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Bridge DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('warning-kind')).toHaveTextContent('spot-impact');
    });

    expect(screen.getByTestId('warning-message')).toHaveTextContent('below the current spot value');
  });

  test('warns when an ETH to MKR quote falls below the current spot value', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('5'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockImplementation((packet) => {
      if (packet.convertto === GLOBAL_IADDRESS.MKR) {
        return Promise.resolve({
          result: { estimatedcurrencyout: 0.45 }
        });
      }

      return Promise.resolve({});
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Bridge MKR' }));

    await waitFor(() => {
      expect(screen.getByTestId('warning-kind')).toHaveTextContent('spot-impact');
    });

    expect(screen.getByTestId('warning-message')).toHaveTextContent('below the current spot value');
  });

  test('exposes pending and ready quote states for conversion routes', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();
    const deferredEstimate = createDeferred();

    mockVerusd.estimateConversion.mockReturnValue(deferredEstimate.promise);

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('pending');
    });

    expect(screen.getByTestId('has-fresh-receive-quote')).toHaveTextContent('no');
    expect(screen.getByTestId('receive-amount')).toHaveTextContent('Estimating...');

    deferredEstimate.resolve({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('has-fresh-receive-quote')).toHaveTextContent('yes');
  });

  test('marks failed conversion quotes unavailable, keeps the estimate text non-numeric, and blocks review', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockRejectedValue(new Error('quote rpc down'));

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('unavailable');
    });

    expect(screen.getByTestId('receive-amount')).toHaveTextContent('Estimating...');
    expect(screen.getByTestId('submit-disabled-reason')).toHaveTextContent('Awaiting receive quote');

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    expect(screen.getByTestId('is-reviewing')).toHaveTextContent('no');
  });

  test('invalidates a prior quote when the amount changes and waits for a fresh quote', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();
    const deferredEstimate = createDeferred();

    mockVerusd.estimateConversion
      .mockResolvedValueOnce({
        result: { estimatedcurrencyout: 0.00107949 }
      })
      .mockReturnValueOnce(deferredEstimate.promise);

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Bridge ETH' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change Amount' }));

    await waitFor(() => {
      expect(screen.getByTestId('receive-quote-state')).toHaveTextContent('pending');
    });

    expect(screen.getByTestId('has-fresh-receive-quote')).toHaveTextContent('no');
    expect(screen.getByTestId('receive-amount')).toHaveTextContent('Estimating...');
  });

  test('defers public key signing until a bounceback review needs it', async () => {
    const request = vi.fn().mockRejectedValue(new Error('User rejected request'));
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });

    expect(request).not.toHaveBeenCalled();
  });

  test('marks public key signing as actionable when bounceback review signing is rejected', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const request = vi.fn().mockRejectedValue(new Error('User rejected request'));
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Swap' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: 'personal_sign',
        params: expect.any(Array)
      });
    });

    expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('no');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('Public key signature is required');
    expect(JSON.parse(window.localStorage.getItem(REFUND_ADDRESS_SIGNATURE_STATUS_KEY))).toEqual({
      '0xabc': 'failed'
    });
  });

  test('opens bounceback review after successful deferred signing and submits with the derived refund address', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const wallet = new Wallet('0x0123456789012345678901234567890123456789012345678901234567890123');
    const signature = await wallet.signMessage(REFUND_ADDRESS_MESSAGE);
    const expectedRefundAddress = getRefundAddressFromSignature(signature);
    const request = vi.fn().mockResolvedValue(signature);
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransfer = vi.fn().mockResolvedValue({ wait });
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('3')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract({ sendTransfer });

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: wallet.address, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Swap DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(REFUND_ADDRESS_STORAGE_KEY))).toEqual({
      [wallet.address]: expectedRefundAddress
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Transfer' }));

    await waitFor(() => {
      expect(sendTransfer).toHaveBeenCalledTimes(1);
    });

    expect(library.getNetwork).toHaveBeenCalled();
    expect(library.getCode).toHaveBeenCalled();

    const [reserveTransfer, txOptions] = sendTransfer.mock.calls[0];
    expect(reserveTransfer.destination.destinationaddress).toContain(
      convertVerusAddressToEthAddress(expectedRefundAddress).slice(2)
    );
    expect(txOptions.from).toBe(wallet.address);
  });

  test('submits bounceback with a legacy cached refund address without requesting a signature', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const wallet = new Wallet('0x2222222222222222222222222222222222222222222222222222222222222222');
    const request = vi.fn();
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const sendTransfer = vi.fn().mockResolvedValue({ wait });
    window.ethereum = { request };
    cacheRefundAddress(wallet.address);
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('3')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract({ sendTransfer });

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: wallet.address, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Swap DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });

    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Transfer' }));

    await waitFor(() => {
      expect(sendTransfer).toHaveBeenCalledTimes(1);
    });

    const [reserveTransfer] = sendTransfer.mock.calls[0];
    expect(reserveTransfer.destination.destinationaddress).toContain(
      convertVerusAddressToEthAddress(VALID_REFUND_ADDRESS).slice(2)
    );
  });

  test('blocks bounceback submit when public key signing is rejected', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const request = vi.fn().mockRejectedValue(new Error('User rejected request'));
    const sendTransfer = vi.fn();
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('3')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract({ sendTransfer });

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0x1234567890123456789012345678901234567890', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Swap DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Transfer' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: 'personal_sign',
        params: expect.any(Array)
      });
    });

    expect(sendTransfer).not.toHaveBeenCalled();
    expect(screen.getByTestId('alert-message')).toHaveTextContent('Public key signature is required');
  });

  test('reuses an in-flight public key signing request for repeated bounceback review attempts', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const wallet = new Wallet('0x1111111111111111111111111111111111111111111111111111111111111111');
    const signature = await wallet.signMessage(REFUND_ADDRESS_MESSAGE);
    const signingRequest = createDeferred();
    const request = vi.fn().mockReturnValue(signingRequest.promise);
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('3')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: wallet.address, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Swap DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      signingRequest.resolve(signature);
      await signingRequest.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });
  });

  test('does not keep direct routes blocked while bounceback signing is pending', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });
    const wallet = new Wallet('0x3333333333333333333333333333333333333333333333333333333333333333');
    const signature = await wallet.signMessage(REFUND_ADDRESS_MESSAGE);
    const signingRequest = createDeferred();
    const request = vi.fn().mockReturnValue(signingRequest.promise);
    window.ethereum = { request };
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('3')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    mockVerusd.estimateConversion.mockResolvedValue({
      result: { estimatedcurrencyout: 0.00107949 }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: wallet.address, library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Swap DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('refund-signature-pending')).toHaveTextContent('yes');

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));

    await waitFor(() => {
      expect(screen.getByTestId('submit-disabled-reason')).toBeEmptyDOMElement();
    });

    expect(screen.getByTestId('refund-signature-pending')).toHaveTextContent('no');
    expect(screen.getByTestId('can-submit')).toHaveTextContent('yes');

    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('has-review-snapshot')).toHaveTextContent('yes');
    });

    await act(async () => {
      signingRequest.resolve(signature);
      await signingRequest.promise;
    });
  });

  test('blocks ERC20 review confirmation when native ETH is below the bridge fee', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('0.0005'))
    });
    const delegatorContract = createDelegatorContract();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-confirm-label')).toHaveTextContent('Not enough ETH');
    });

    expect(screen.getByTestId('review-route-label')).toHaveTextContent(directRouteLabel);
    expect(screen.getByTestId('review-time-estimate')).toHaveTextContent('1-6 hours');
    expect(screen.getByTestId('review-bounceback-warning')).toBeEmptyDOMElement();
    expect(screen.getByTestId('review-fees').textContent).not.toContain('Network cost:');
    expect(screen.getByTestId('can-confirm-review')).toHaveTextContent('no');
  });

  test('requires ETH senders to cover the send amount plus the bridge fee', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1.0'))
    });
    const delegatorContract = createDelegatorContract({
      callStatic: {
        verusToERC20mapping: vi.fn().mockResolvedValue({ flags: '0' })
      }
    });

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure ETH Direct' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-confirm-label')).toHaveTextContent('Not enough ETH');
    });

    expect(screen.getByTestId('can-confirm-review')).toHaveTextContent('no');
  });

  test('adds the gateway/import fee to review rows for swap routes', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });

    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    cacheRefundAddress();
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Swap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-fees').textContent).toContain('Network cost:0.012 ETH');
    });
  });

  test('shows the longer review time estimate for bounceback routes', async () => {
    global.fetch = vi.fn((input) => {
      if (input === './exclude.json') {
        return Promise.resolve({
          json: async () => ({ ETH: [] }),
          ok: true
        });
      }

      return new Promise(() => {});
    });

    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1')),
      getBlockNumber: vi.fn().mockResolvedValue(100),
      getBlock: vi.fn().mockResolvedValue({ transactions: ['0xtx1', '0xtx2', '0xtx3'] }),
      getTransaction: vi.fn().mockResolvedValue({ gasPrice: '10000000000' })
    });
    const delegatorContract = createDelegatorContract();

    cacheRefundAddress();
    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Swap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(screen.getByTestId('review-route-label')).toHaveTextContent(bouncebackRouteLabel);
    });

    expect(screen.getByTestId('review-time-estimate')).toHaveTextContent('2-10 hours');
    expect(screen.getByTestId('review-bounceback-warning')).toHaveTextContent(
      /can take 2-10 hours to complete/i
    );
  });

  test('calls enterReview after capturing a valid review snapshot and exits routed review when edits invalidate it', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();
    const enterReview = vi.fn();
    const exitReview = vi.fn();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    const { rerender } = render(
      <HookProbe
        controllerOptions={{
          enterReview,
          exitReview,
          isReviewRequested: false
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('catalog-loading')).toHaveTextContent('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(enterReview).toHaveBeenCalledTimes(1);
    });

    rerender(
      <HookProbe
        controllerOptions={{
          enterReview,
          exitReview,
          isReviewRequested: true
        }}
      />
    );

    expect(screen.getByTestId('is-reviewing')).toHaveTextContent('yes');

    fireEvent.click(screen.getByRole('button', { name: 'Change Amount' }));

    await waitFor(() => {
      expect(exitReview).toHaveBeenCalledWith({ hash: '' });
    });

    expect(screen.getByTestId('is-reviewing')).toHaveTextContent('no');
  });

  test('calls exitReview when the routed review is explicitly closed', async () => {
    const library = createLibrary({
      getBalance: vi.fn().mockResolvedValue(utils.parseEther('1'))
    });
    const delegatorContract = createDelegatorContract();
    const enterReview = vi.fn();
    const exitReview = vi.fn();

    useWeb3React.mockReturnValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID, account: '0xabc', library });
    useContract.mockReturnValue(delegatorContract);

    const { rerender } = render(
      <HookProbe
        controllerOptions={{
          enterReview,
          exitReview,
          isReviewRequested: false
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('source-symbols')).toHaveTextContent('DAI');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Direct DAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }));

    await waitFor(() => {
      expect(enterReview).toHaveBeenCalledTimes(1);
    });

    rerender(
      <HookProbe
        controllerOptions={{
          enterReview,
          exitReview,
          isReviewRequested: true
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close Review' }));

    await waitFor(() => {
      expect(exitReview).toHaveBeenCalledWith({ hash: '' });
    });

    expect(screen.getByTestId('is-reviewing')).toHaveTextContent('no');
  });
});
