import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { GLOBAL_ADDRESS } from 'constants/contractAddress';

import BridgeCard from './BridgeCard';
import styles from '../styles/ReferenceBridge.module.css';

const createMatchMedia = (matches = false) => vi.fn().mockImplementation((query) => ({
  matches,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn()
}));

const setMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: createMatchMedia(matches),
    writable: true
  });
};

const selectedToken = {
  name: 'vETH',
  ticker: 'ETH',
  value: '0x454CB83913D688795E237837d30258d11ea7c752',
  erc20address: '0x0000000000000000000000000000000000000000'
};

const createController = (overrides = {}) => ({
  alert: null,
  allowsEthereumDestination: true,
  handleSubmit: vi.fn(),
  amount: '',
  amountFiatLabel: null,
  amountError: '',
  setAmount: vi.fn(),
  isWalletConnected: false,
  tokenBalance: '',
  tokenBalanceLabel: '',
  handleMaxAmount: vi.fn(),
  estimatedDisplayValue: '',
  estimatedFiatLabel: null,
  receiveAmountDisplay: '',
  receiveCurrency: null,
  receiveFiatLabel: null,
  routeLabel: '',
  feeEstimate: '',
  address: '',
  addressHint: 'Enter a Verus address (R-address or i-address) or Ethereum address',
  addressError: '',
  addressPlaceholder: 'Enter receiving address',
  account: '',
  canConfirmReview: false,
  hasFreshReceiveQuote: true,
  receiveQuoteState: 'not-required',
  requiresReceiveQuote: false,
  conversionWarningGapPercent: null,
  conversionWarningKind: null,
  conversionWarningMessage: '',
  setAddress: vi.fn(),
  canSubmit: false,
  closeReview: vi.fn(),
  hasEnoughNativeEth: true,
  isReviewing: false,
  isRefundSignaturePending: false,
  isTxPending: false,
  nativeEthBalance: 0,
  openReview: vi.fn(),
  requiredNativeEth: 0,
  reviewConfirmLabel: 'Confirm',
  reviewBouncebackWarningMessage: '',
  reviewExchangeRate: null,
  reviewFeeRows: [],
  reviewReceiveAmountDisplay: '',
  reviewReceiveFiatLabel: null,
  reviewRouteLabel: 'Ethereum -> Verus',
  reviewTimeEstimate: '1-6 hours',
  sendAmountPresets: [{ id: 'max', label: 'Max', amount: '1' }],
  sendAmountPresetWarningMessage: '',
  selectedToken,
  selectedDestination: null,
  destinationEmptyStateMessage: 'No currencies available yet. Enter a valid destination address to unlock receive options.',
  sourceCurrencies: undefined,
  isSourceCatalogLoading: false,
  isSourceCurrenciesLoading: false,
  sourceCatalogError: null,
  tokenOptions: [selectedToken],
  destinationOptions: [{ value: 'DAI.vETH' }],
  retrySourceCatalog: vi.fn(),
  selectToken: vi.fn(),
  selectDestination: vi.fn(),
  ...overrides
});

describe('BridgeCard currency selectors', () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

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

  test('keeps the receive amount blank before a receive currency is selected', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '0.322832',
          amountFiatLabel: '$0.32',
          isWalletConnected: true,
          receiveAmountDisplay: '--',
          selectedDestination: null
        })}
      />
    );

    expect(screen.queryByDisplayValue('Estimating...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select currency to receive' })).toBeDisabled();
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

    expect(screen.getByText('You receive (estimated)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('~0.00107949')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
  });

  test('opens estimated receive details for conversion quotes only', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          hasFreshReceiveQuote: true,
          isWalletConnected: true,
          receiveAmountDisplay: '0.00107949',
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.queryByRole('dialog', { name: /estimated receive details/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show estimated receive details/i }));

    expect(screen.getByRole('dialog', { name: /estimated receive details/i })).toBeInTheDocument();
    expect(screen.getByText(/estimated and not guaranteed/i)).toBeInTheDocument();
    expect(screen.getByText(/final value can shift before completion/i)).toBeInTheDocument();
  });

  test('closes estimated receive details when clicking outside the popover', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          hasFreshReceiveQuote: true,
          isWalletConnected: true,
          receiveAmountDisplay: '0.00107949',
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /show estimated receive details/i }));

    expect(screen.getByRole('dialog', { name: /estimated receive details/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /estimated receive details/i })).not.toBeInTheDocument();
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
            { id: 'bridge-fee', label: 'Bridge fee', value: '0.0030 ETH', fiatLabel: '$6.30' }
          ],
          reviewRouteLabel: 'Ethereum -> Verus',
          reviewTimeEstimate: '1-6 hours',
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
    expect(screen.getByText('0.0030 ETH')).toBeInTheDocument();
    expect(screen.getByText('($6.30)')).toBeInTheDocument();
    expect(screen.queryByText('Network cost')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ethereum -> Verus')).toBeInTheDocument();
    expect(screen.getByText('1-6 hours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not enough ETH' })).toBeDisabled();
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.reviewCardSection)).toHaveLength(2);
    expect(container.getElementsByClassName(styles.reviewSummaryRow)).toHaveLength(2);

    expect(screen.queryByRole('dialog', { name: /estimated time details/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show estimated time details/i }));

    expect(screen.getByRole('dialog', { name: /estimated time details/i })).toBeInTheDocument();
    expect(screen.getByText(/more activity on the bridge can help transfers complete faster/i)).toBeInTheDocument();
    expect(screen.getByText(/bridge protocol settles in a decentralized way/i)).toBeInTheDocument();
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
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.getByText('You receive (estimated)')).toBeInTheDocument();
    expect(screen.getByText('~0.00107949')).toBeInTheDocument();
    expect(screen.queryByText('Estimating...')).not.toBeInTheDocument();
  });

  test('shows a clickable review exchange rate that can invert', () => {
    render(
      <BridgeCard
        controller={createController({
          amount: '2.290298377929176',
          canConfirmReview: true,
          isReviewing: true,
          receiveCurrency: {
            id: 'bridgeETH',
            icon: '/icons/currencies/eth.svg',
            name: 'vETH',
            symbol: 'vETH'
          },
          reviewConfirmLabel: 'Confirm',
          reviewExchangeRate: {
            primary: {
              fiatLabel: '$1,000.00',
              label: '1 vETH = 2121.65 DAI'
            },
            inverse: {
              fiatLabel: '$1.00',
              label: '1 DAI = 0.00047133 vETH'
            }
          },
          reviewReceiveAmountDisplay: '0.00107949',
          requiresReceiveQuote: true,
          selectedDestination: { value: 'bridgeETH' }
        })}
      />
    );

    expect(screen.getByText('1 vETH = 2121.65 DAI')).toBeInTheDocument();
    expect(screen.getByText('($1,000.00)')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Price').closest(`.${styles.reviewDetails}`)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /invert exchange rate/i }));

    expect(screen.getByText('1 DAI = 0.00047133 vETH')).toBeInTheDocument();
    expect(screen.getByText('($1.00)')).toBeInTheDocument();
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

  test('shows desktop amount presets for hover-capable connected wallets', () => {
    setMatchMedia(true);

    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          sendAmountPresets: [
            { id: '25', label: '25%', amount: '0.25' },
            { id: '50', label: '50%', amount: '0.5' },
            { id: '75', label: '75%', amount: '0.75' },
            { id: 'max', label: 'Max', amount: '1' }
          ],
          tokenBalance: '1',
          tokenBalanceLabel: '1 ETH'
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Set amount to 25%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to 50%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to 75%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to Max' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^max$/i })).not.toBeInTheDocument();
  });

  test('keeps only the footer max button on non-hover clients', () => {
    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          sendAmountPresets: [
            { id: '25', label: '25%', amount: '0.25' },
            { id: '50', label: '50%', amount: '0.5' },
            { id: '75', label: '75%', amount: '0.75' },
            { id: 'max', label: 'Max', amount: '1' }
          ],
          tokenBalance: '1',
          tokenBalanceLabel: '1 ETH'
        })}
      />
    );

    expect(screen.queryByRole('button', { name: 'Set amount to 25%' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^max$/i })).toBeInTheDocument();
  });

  test('clicking a desktop amount preset sets the send amount', () => {
    const setAmount = vi.fn();

    setMatchMedia(true);

    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          sendAmountPresets: [
            { id: '25', label: '25%', amount: '0.25' },
            { id: '50', label: '50%', amount: '0.5' },
            { id: '75', label: '75%', amount: '0.75' },
            { id: 'max', label: 'Max', amount: '1' }
          ],
          setAmount,
          tokenBalance: '1',
          tokenBalanceLabel: '1 ETH'
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 75%' }));

    expect(setAmount).toHaveBeenCalledWith('0.75');
  });

  test('shows desktop amount presets for ETH balances that cannot cover fees', () => {
    setMatchMedia(true);

    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          sendAmountPresets: [],
          sendAmountPresetWarningMessage: "You don't have enough ETH to pay the bridge and network fees for this transfer. Estimated fees: 0.0030 ETH.",
          tokenBalance: { raw: '0.003', display: '0.003 ETH' },
          tokenBalanceLabel: '0.003 ETH'
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Set amount to 25%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to 50%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to 75%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set amount to Max' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^max$/i })).not.toBeInTheDocument();
  });

  test('clicking a blocked ETH amount preset opens the fee warning popover', () => {
    const setAmount = vi.fn();

    setMatchMedia(true);

    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: true,
          sendAmountPresets: [],
          sendAmountPresetWarningMessage: "You don't have enough ETH to pay the bridge and network fees for this transfer. Estimated fees: 0.0030 ETH.",
          setAmount,
          tokenBalance: { raw: '0.003', display: '0.003 ETH' },
          tokenBalanceLabel: '0.003 ETH'
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set amount to Max' }));

    expect(setAmount).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /send amount preset details/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have enough ETH to pay the bridge and network fees/i)).toBeInTheDocument();
  });

  test('does not show desktop amount presets for disconnected wallets', () => {
    setMatchMedia(true);

    render(
      <BridgeCard
        controller={createController({
          isWalletConnected: false,
          sendAmountPresets: [
            { id: '25', label: '25%', amount: '0.25' },
            { id: '50', label: '50%', amount: '0.5' },
            { id: '75', label: '75%', amount: '0.75' },
            { id: 'max', label: 'Max', amount: '1' }
          ],
          tokenBalance: '1',
          tokenBalanceLabel: '1 ETH'
        })}
      />
    );

    expect(screen.queryByRole('button', { name: 'Set amount to 25%' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set amount to Max' })).not.toBeInTheDocument();
  });

  test('shows the receive fiat inline without the bounceback path footer', () => {
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
    expect(screen.queryByText(/path: ethereum/i)).not.toBeInTheDocument();
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
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

    expect(screen.getByText('You receive')).toBeInTheDocument();
    expect(screen.queryByText('You receive (estimated)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show estimated receive details/i })).not.toBeInTheDocument();
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

  test('shows a bounceback warning in review mode only', () => {
    const warningMessage = 'This bounceback route can take 2-10 hours to complete. The estimated amount shown here can change significantly before settlement if pricing moves during that time. Use caution before confirming.';

    const { rerender } = render(
      <BridgeCard
        controller={createController({
          isReviewing: false,
          reviewBouncebackWarningMessage: warningMessage,
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    expect(screen.queryByText(/bounceback warning:/i)).not.toBeInTheDocument();

    rerender(
      <BridgeCard
        controller={createController({
          isReviewing: true,
          reviewBouncebackWarningMessage: warningMessage,
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    expect(screen.getByText(/bounceback warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/can take 2-10 hours to complete/i)).toBeInTheDocument();
  });

  test('shows bounceback and slippage warnings together in review mode', () => {
    render(
      <BridgeCard
        controller={createController({
          canConfirmReview: true,
          conversionWarningKind: 'spot-impact',
          conversionWarningMessage: 'This quote is 5.0% below the current spot value.',
          isReviewing: true,
          reviewBouncebackWarningMessage: 'This bounceback route can take 2-10 hours to complete. The estimated amount shown here can change significantly before settlement if pricing moves during that time. Use caution before confirming.',
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    expect(screen.getByText(/high slippage warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/bounceback warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/below the current spot value/i)).toBeInTheDocument();
    expect(screen.getByText(/use caution before confirming/i)).toBeInTheDocument();
  });

  test('shows a spinner on the review confirmation button while submitting', () => {
    render(
      <BridgeCard
        controller={createController({
          canConfirmReview: false,
          isReviewing: true,
          isTxPending: true,
          reviewConfirmLabel: 'Submitting...',
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    const submitButton = screen.getByRole('button', { name: /submitting/i });
    expect(within(submitButton).getByText(/submitting/i)).toBeInTheDocument();
    expect(submitButton.querySelector(`.${styles.buttonSpinner}`)).toBeInTheDocument();
  });

  test('closes the send currency picker when the user clicks outside it', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });

  test('renders the currency picker outside the bridge card stacking context', () => {
    const { container } = render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test('locks background scroll while the currency picker is open', () => {
    const originalBodyStyles = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
      writable: true
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 240,
      writable: true
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1000
    });

    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.paddingRight).toBe('24px');

    fireEvent.click(screen.getByRole('button', { name: /close currency picker/i }));

    expect(document.body.style.overflow).toBe(originalBodyStyles.overflow);
    expect(document.body.style.position).toBe(originalBodyStyles.position);
    expect(document.body.style.top).toBe(originalBodyStyles.top);
    expect(document.body.style.width).toBe(originalBodyStyles.width);
    expect(document.body.style.paddingRight).toBe(originalBodyStyles.paddingRight);
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

  test('uses Verus-only address copy and hides the Ethereum self shortcut for one-way routes', () => {
    render(
      <BridgeCard
        controller={createController({
          account: '0xabc',
          allowsEthereumDestination: false,
          addressHint: 'Enter a Verus address (R-address or i-address)',
          addressPlaceholder: 'Enter Verus receiving address'
        })}
      />
    );

    expect(screen.getByText('Enter a Verus address (R-address or i-address)')).toBeInTheDocument();
    expect(screen.queryByText(/or Ethereum address/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Verus receiving address')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /self/i })).not.toBeInTheDocument();
  });

  test('compacts Verus addresses on blur and restores the full value on focus', () => {
    const address = 'iMEHwE9yPu5HkVbZ9RRLE6ZZpFfLtu4wLv';

    render(
      <BridgeCard
        controller={createController({
          address
        })}
      />
    );

    const input = screen.getByDisplayValue('iMEHwE...4wLv');

    fireEvent.focus(input);
    expect(screen.getByDisplayValue(address)).toBeInTheDocument();

    fireEvent.blur(screen.getByDisplayValue(address));
    expect(screen.getByDisplayValue('iMEHwE...4wLv')).toBeInTheDocument();
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
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
    expect(screen.queryByText('Others')).not.toBeInTheDocument();
  });

  test('groups the disconnected source catalog into Popular and Others', () => {
    render(
      <BridgeCard
        controller={createController({
          selectedToken: null,
          sourceCurrencies: [
            { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: '/icons/currencies/eth.svg' },
            { id: 'vrsc', name: 'Verus', symbol: 'VRSC', icon: '/icons/currencies/vrsc.svg' },
            { id: 'dai', name: 'Dai Stablecoin', symbol: 'DAI', icon: '/icons/currencies/dai.svg', value: GLOBAL_ADDRESS.DAI },
            { id: 'mkr', name: 'Maker', symbol: 'MKR', icon: '/icons/currencies/mkr.svg' },
            { id: 'usdc', name: 'USD Coin', symbol: 'USDC', icon: '/icons/currencies/usdc.svg' },
            { id: 'tbtc', name: 'tBTC v2', symbol: 'TBTC', icon: '/icons/currencies/tbtc.svg' },
            { id: 'usdt', name: 'Tether USD', symbol: 'USDT', icon: '/icons/currencies/usdt.svg' },
            { id: 'eurc', name: 'Euro Coin', symbol: 'EURC', icon: '/icons/currencies/eurc.svg' },
            { id: 'scrvusd', name: 'Savings crvUSD', symbol: 'SCRVUSD', icon: '/icons/currencies/scrvUSD.svg' },
            { id: 'crvusd', name: 'Curve.Fi USD Stablecoin', symbol: 'CRVUSD', icon: '/icons/currencies/crvUSD.svg' },
            { id: 'wbtc', name: 'Wrapped BTC', symbol: 'WBTC', icon: '/icons/currencies/wbtc.svg' },
            { id: 'alpha', name: 'Alpha Token', symbol: 'ALPHA', icon: '/icons/currencies/placeholder.svg' },
            { id: 'kaiju', name: 'Kaiju', symbol: 'KAIJU', icon: '/icons/currencies/kaiju.svg' }
          ]
        })}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /select currency/i })[0]);

    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();
    expect(screen.getByText('Verus')).toBeInTheDocument();
    expect(screen.getByText('VRSC')).toBeInTheDocument();

    expect(Array.from(document.getElementsByClassName(styles.currencyOption)).map((element) => element.textContent)).toEqual([
      'EthereumETH',
      'VerusVRSC',
      'Dai StablecoinDAI',
      'MakerMKR',
      'USD CoinUSDC',
      'tBTC v2TBTC',
      'Tether USDUSDT',
      'Euro CoinEURC',
      'Savings crvUSDSCRVUSD',
      'Curve.Fi USD StablecoinCRVUSD',
      'Wrapped BTCWBTC',
      'Alpha TokenALPHA',
      'KaijuKAIJU'
    ]);
  });

  test('keeps a balance-only source row in balance styling when fiat is unavailable', () => {
    render(
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
    expect(document.getElementsByClassName(styles.currencyOptionValue)).toHaveLength(0);
    expect(document.getElementsByClassName(styles.currencyOptionBalanceOnly)).toHaveLength(1);
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
    const retrySourceCatalog = vi.fn();

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
