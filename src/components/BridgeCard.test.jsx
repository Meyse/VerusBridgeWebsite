import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import BridgeCard from './BridgeCard';

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
  amountError: '',
  setAmount: jest.fn(),
  isWalletConnected: false,
  tokenBalance: '',
  tokenBalanceLabel: '',
  handleMaxAmount: jest.fn(),
  estimatedDisplayValue: '',
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
  tokenOptions: [selectedToken],
  destinationOptions: [{ value: 'DAI.vETH' }],
  selectToken: jest.fn(),
  selectDestination: jest.fn(),
  ...overrides
});

describe('BridgeCard currency selectors', () => {
  test('closes the send currency picker when the user clicks outside it', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /eth/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });

  test('closes the receive currency picker when the user clicks outside it', () => {
    render(<BridgeCard controller={createController()} />);

    fireEvent.click(screen.getByRole('button', { name: /select currency/i }));

    expect(screen.getByRole('dialog', { name: /select a currency/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /select a currency/i })).not.toBeInTheDocument();
  });
});
