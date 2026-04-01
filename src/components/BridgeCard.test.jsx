import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

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
  routeLabel: '',
  feeEstimate: '',
  address: '',
  addressError: '',
  account: '',
  setAddress: jest.fn(),
  canSubmit: false,
  isTxPending: false,
  selectedToken,
  selectedDestination: null,
  sourceCurrencies: undefined,
  isSourceCurrenciesLoading: false,
  tokenOptions: [selectedToken],
  destinationOptions: [{ value: 'DAI.vETH' }],
  selectToken: jest.fn(),
  selectDestination: jest.fn(),
  ...overrides
});

describe('BridgeCard currency selectors', () => {
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
    expect(container.getElementsByClassName(styles.amountInlineFiat)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
  });

  test('shows the receive fiat inline while keeping the routing footer below', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '1',
          amountFiatLabel: '$1.00',
          estimatedDisplayValue: '0.998',
          estimatedFiatLabel: '$0.99',
          routeLabel: 'Ethereum -> Verus -> Ethereum',
          selectedDestination: { value: 'swaptoETH' }
        })}
      />
    );

    expect(screen.getByText('$0.99')).toBeInTheDocument();
    expect(screen.getByText(/path: ethereum/i)).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(1);
  });

  test('keeps the receive section at standard height when only the inline fiat value is present', () => {
    const { container } = render(
      <BridgeCard
        controller={createController({
          amount: '1',
          estimatedDisplayValue: '0.998',
          estimatedFiatLabel: '$0.99',
          selectedToken: null,
          selectedDestination: { value: 'bridgeDAI' }
        })}
      />
    );

    expect(screen.getByText('$0.99')).toBeInTheDocument();
    expect(container.getElementsByClassName(styles.amountInlineFiat)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.cardSectionWithFooter)).toHaveLength(0);
    expect(container.getElementsByClassName(styles.selectorWithFooter)).toHaveLength(0);
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
});
