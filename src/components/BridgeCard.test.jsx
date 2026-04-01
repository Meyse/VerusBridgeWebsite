import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import BridgeCard from './BridgeCard';
import styles from '../styles/ReferenceBridge.module.css';

const selectedToken = {
  name: 'vETH',
  ticker: 'ETH',
  value: '0x454CB83913D688795E237837d30258d11ea7c752',
  erc20address: '0x0000000000000000000000000000000000000000'
};

const createController = (overrides = {}) => ({
  alert: null,
  handleSubmit: jest.fn(),
  amount: '',
  amountFiatLabel: null,
  amountError: '',
  setAmount: jest.fn(),
  isWalletConnected: false,
  tokenBalance: '',
  tokenBalanceLabel: '',
  handleMaxAmount: jest.fn(),
  estimatedDisplayValue: '',
  estimatedFiatLabel: null,
  receiveAmountDisplay: '',
  receiveCurrency: null,
  receiveFiatLabel: null,
  routeLabel: '',
  feeEstimate: '',
  address: '',
  addressError: '',
  account: '',
  canConfirmReview: false,
  hasFreshReceiveQuote: true,
  receiveQuoteState: 'not-required',
  requiresReceiveQuote: false,
  conversionWarningGapPercent: null,
  conversionWarningKind: null,
  conversionWarningMessage: '',
  setAddress: jest.fn(),
  canSubmit: false,
  closeReview: jest.fn(),
  hasEnoughNativeEth: true,
  isReviewing: false,
  isTxPending: false,
  nativeEthBalance: 0,
  openReview: jest.fn(),
  requiredNativeEth: 0,
  reviewConfirmLabel: 'Confirm',
  reviewFeeRows: [],
  reviewReceiveAmountDisplay: '',
  reviewReceiveFiatLabel: null,
  reviewRouteLabel: 'Ethereum -> Verus',
  reviewTimeEstimate: '~10-30 min',
  reviewWarningMessage: '',
  selectedToken,
  selectedDestination: null,
  sourceCurrencies: undefined,
  isSourceCatalogLoading: false,
  isSourceCurrenciesLoading: false,
  sourceCatalogError: null,
  tokenOptions: [selectedToken],
  destinationOptions: [{ value: 'DAI.vETH' }],
  retrySourceCatalog: jest.fn(),
  selectToken: jest.fn(),
  selectDestination: jest.fn(),
  ...overrides
});

describe('BridgeCard currency selectors', () => {
  test('shows Review as the edit-step primary CTA', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '1',
          address: 'iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv',
          canSubmit: true,
          isWalletConnected: true,
          selectedDestination: { value: 'VRSC' }
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm conversion/i })).not.toBeInTheDocument();
  });

  test('shows Estimating... and disables Review while a conversion quote is pending', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          address: 'iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv',
          canSubmit: false,
          hasFreshReceiveQuote: false,
          isWalletConnected: true,
          receiveAmountDisplay: 'Estimating...',
          receiveQuoteState: 'pending',
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.getByDisplayValue('Estimating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimating...' })).toBeDisabled();
  });

  test('shows the full receive quote when a conversion quote is ready', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          amountFiatLabel: '$2.29',
          canSubmit: true,
          hasFreshReceiveQuote: true,
          isWalletConnected: true,
          receiveAmountDisplay: '0.00107949',
          receiveCurrency: {
            id: 'bridgeETH',
            icon: '/icons/currencies/eth.svg',
            name: 'vETH',
            symbol: 'vETH'
          },
          receiveQuoteState: 'ready',
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.getByDisplayValue('0.00107949')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
  });

  test('renders the inline review state with fee rows and a not-enough-eth CTA', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          amountFiatLabel: '$2.29',
          canConfirmReview: false,
          isReviewing: true,
          nativeEthBalance: 0,
          receiveAmountDisplay: '2.29029837',
          receiveCurrency: {
            id: 'VRSC',
            icon: '/icons/currencies/dai.svg',
            name: 'DAI.vETH',
            symbol: 'DAI.vETH'
          },
          receiveFiatLabel: '$2.29',
          requiredNativeEth: 0.003,
          reviewConfirmLabel: 'Not enough ETH',
          reviewFeeRows: [
            { id: 'bridge-fee', label: 'Bridge fee', value: '0.0030 ETH', fiatLabel: '$6.30' },
            { id: 'network-cost', label: 'Network cost', value: '0.0000 ETH', fiatLabel: null }
          ],
          reviewRouteLabel: 'Ethereum -> Verus',
          reviewTimeEstimate: '~10-30 min',
          reviewWarningMessage: 'Not enough ETH to cover bridge fees.',
          selectedDestination: { value: 'VRSC' }
        })}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit details/i });

    expect(editButton).toBeInTheDocument();
    expect(editButton.closest('form')).toBeNull();
    expect(editButton.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('DAI.vETH')).toBeInTheDocument();
    expect(screen.getByText('Bridge fee')).toBeInTheDocument();
    expect(screen.getByText('Estimated time')).toBeInTheDocument();
    expect(screen.getByText('Not enough ETH to cover bridge fees.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not enough ETH' })).toBeDisabled();
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.reviewCardSection)).toHaveLength(2);
    expect(container.getElementsByClassName(styles.reviewSummaryRow)).toHaveLength(2);
  });

  test('shows the snapped conversion quote in the review step', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          canConfirmReview: true,
          isReviewing: true,
          receiveAmountDisplay: 'Estimating...',
          receiveCurrency: {
            id: 'bridgeETH',
            icon: '/icons/currencies/eth.svg',
            name: 'vETH',
            symbol: 'vETH'
          },
          reviewConfirmLabel: 'Confirm',
          reviewReceiveAmountDisplay: '0.00107949',
          reviewRouteLabel: 'Ethereum -> Verus',
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.getByText('0.00107949')).toBeInTheDocument();
    expect(screen.queryByText('Estimating...')).not.toBeInTheDocument();
  });

  test('shows the send fiat in the lower meta row alongside the balance row', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amountFiatLabel: '$42.10',
          isWalletConnected: true,
          tokenBalance: '0.000022',
          tokenBalanceLabel: '0.000022 ETH'
        })}
      />
    );

    expect(screen.getByText('$42.10')).toBeInTheDocument();
    expect(screen.getByText('0.000022 ETH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /max/i })).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.fiatValue)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
  });

  test('shows the receive fiat inline while keeping the routing footer below', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '1',
          amountFiatLabel: '$1.00',
          receiveAmountDisplay: '0.998',
          receiveFiatLabel: '$0.99',
          routeLabel: 'Ethereum -> Verus -> Ethereum',
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    expect(screen.getByText('$0.99')).toBeInTheDocument();
    expect(screen.getByText(/path: ethereum/i)).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.receiveMeta)).toHaveLength(1);
  });

  test('keeps the receive section at standard height when only the inline fiat value is present', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '1',
          receiveAmountDisplay: '0.998',
          receiveFiatLabel: '$0.99',
          selectedToken: null,
          selectedDestination: { value: 'bridgeDAI' }
        })}
      />
    );

    expect(screen.getByText('$0.99')).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.receiveMeta)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.fiatValue)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
  });

  test('shows a conversion warning in the receive footer and review step when the quote is materially off spot', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '1',
          canConfirmReview: true,
          conversionWarningKind: 'spot-impact',
          conversionWarningMessage: 'This quote is 5.0% below the current spot value.',
          isReviewing: false,
          receiveAmountDisplay: '950',
          receiveCurrency: {
            id: 'bridgeDAI',
            icon: '/icons/currencies/dai.svg',
            name: 'Dai Stablecoin',
            symbol: 'DAI.vETH'
          },
          receiveFiatLabel: '$950.00',
          routeLabel: 'Ethereum -> Verus',
          selectedDestination: { value: 'bridgeDAI' }
        })}
      />
    );

    expect(screen.getByText(/high slippage warning:/i)).toBeInTheDocument();
    expect(screen.getByText('This quote is 5.0% below the current spot value.')).toBeInTheDocument();
    expect(screen.queryByText(/1 ETH =/i)).not.toBeInTheDocument();
    expect(container.getElementsByClassName(styles.receiveMeta)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.conversionWarningText)).toHaveLength(1);
  });

  test('shows generic slippage warning copy in review mode', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '1',
          canConfirmReview: true,
          conversionWarningKind: 'better-venue',
          conversionWarningMessage: 'This quote is 7.1% below a better currently available route. You may get a better result by bridging to Verus first, then swapping there.',
          isReviewing: true,
          receiveAmountDisplay: '1400',
          receiveCurrency: {
            id: 'bridgeVRSC',
            icon: '/icons/currencies/vrsc.svg',
            name: 'Verus',
            symbol: 'VRSC'
          },
          reviewConfirmLabel: 'Confirm',
          selectedDestination: { value: 'bridgeVRSC' }
        })}
      />
    );

    expect(screen.getByText(/high slippage warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/better currently available route/i)).toBeInTheDocument();
  });

  test('closes the send currency picker when the user clicks outside it', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });

  test('closes the receive currency picker when the user clicks outside it', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /select currency/i })[0]);

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });

  test('shows human-readable names in the receive picker for direct bridge destinations', () => {
    render(
      <BridgeCard
        controller={createController({
          selectedToken: {
            name: 'vUSDC.vETH',
            ticker: 'USDC',
            ethereumName: 'USD Coin',
            ethereumSymbol: 'USDC',
            value: '0x4444444444444444444444444444444444444444',
            erc20address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
          },
          destinationOptions: [{ value: 'VRSC', iaddress: '0x4444444444444444444444444444444444444444' }]
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select currency/i }));

    const dialog = screen.getByRole('dialog', { name: /select a currency/i });
    expect(within(dialog).getByText('USD Coin')).toBeInTheDocument();
    expect(within(dialog).getByText('vUSDC.vETH')).toBeInTheDocument();
  });

  test('closes the currency picker when the close button is pressed', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close currency picker/i }));

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });

  test('shows only owned wallet assets ordered by fiat value in the send picker', () => {
    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          selectedToken: null,
          sourceCurrencies: [
            {
              id: 'usdc',
              name: 'USD Coin',
              symbol: 'USDC',
              icon: '/icons/currencies/usdc.svg',
              balance: 55,
              balanceLabel: '55 USDC',
              fiatLabel: '$55.00',
              fiatValue: 55
            },
            {
              id: 'eth',
              name: 'Ethereum',
              symbol: 'ETH',
              icon: '/icons/currencies/eth.svg',
              balance: 0.5,
              balanceLabel: '0.5 ETH',
              fiatLabel: '$25.00',
              fiatValue: 25
            }
          ]
        })}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /select currency/i })[0]);

    const options = screen.getAllByRole('button').filter((element) => (
      element.textContent.includes('USD Coin') || element.textContent.includes('Ethereum')
    ));

    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('USD Coin');
    expect(options[0]).toHaveTextContent('$55.00');
    expect(options[0]).toHaveTextContent('55 USDC');
    expect(options[0].textContent.indexOf('$55.00')).toBeLessThan(options[0].textContent.indexOf('55 USDC'));
    expect(options[1]).toHaveTextContent('Ethereum');
    expect(options[1]).toHaveTextContent('$25.00');
    expect(options[1]).toHaveTextContent('0.5 ETH');
    expect(options[1].textContent.indexOf('$25.00')).toBeLessThan(options[1].textContent.indexOf('0.5 ETH'));
    expect(screen.queryByText('Maker')).not.toBeInTheDocument();
  });

  test('keeps a balance-only source row in balance styling when fiat is unavailable', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          selectedToken: null,
          sourceCurrencies: [
            {
              id: 'link',
              name: 'Chainlink',
              symbol: 'LINK',
              icon: '/icons/currencies/link.svg',
              balance: 12,
              balanceLabel: '12 LINK',
              fiatLabel: null,
              fiatValue: null
            }
          ]
        })}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /select currency/i })[0]);

    expect(screen.getByText('12 LINK')).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.currencyOptionValue)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.currencyOptionBalanceOnly)).toHaveLength(1);
  });

  test('shows a disconnected source-catalog loading banner instead of an empty state', () => {
    render(
      <BridgeCard
        controller={createController({
          isSourceCatalogLoading: true,
          sourceCurrencies: [
            {
              id: 'eth',
              name: 'Ethereum',
              symbol: 'ETH',
              icon: '/icons/currencies/eth.svg'
            }
          ]
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByText('Loading all currencies...')).toBeInTheDocument();
    expect(screen.queryByText('No currencies available yet.')).not.toBeInTheDocument();
  });

  test('shows a retry banner when the disconnected source catalog fails', () => {
    const retrySourceCatalog = jest.fn();

    render(
      <BridgeCard
        controller={createController({
          retrySourceCatalog,
          sourceCatalogError: 'Unable to load all currencies right now.',
          sourceCurrencies: [
            {
              id: 'eth',
              name: 'Ethereum',
              symbol: 'ETH',
              icon: '/icons/currencies/eth.svg'
            }
          ]
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByText('Unable to load all currencies right now.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(retrySourceCatalog).toHaveBeenCalledTimes(1);
  });

  test('keeps connected-wallet loading copy unchanged', () => {
    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          isSourceCurrenciesLoading: true,
          selectedToken: null,
          sourceCurrencies: []
        })}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /select currency/i })[0]);

    expect(screen.getByText('Loading wallet assets...')).toBeInTheDocument();
    expect(screen.queryByText('Loading all currencies...')).not.toBeInTheDocument();
  });
});
