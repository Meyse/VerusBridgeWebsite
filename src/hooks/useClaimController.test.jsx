import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';

import { useToast } from 'components/Toast/ToastProvider';
import useContract from 'hooks/useContract';
import bitGoUTXO from 'utils/bitUTXO';
import { requestRefundAddressData } from 'utils/refundAddress';

jest.mock('@web3-react/core', () => ({
  useWeb3React: jest.fn()
}));

jest.mock('components/Toast/ToastProvider', () => ({
  useToast: jest.fn()
}));

jest.mock('hooks/useContract', () => jest.fn());

jest.mock('utils/refundAddress', () => ({
  requestRefundAddressData: jest.fn()
}));

const useClaimController = require('./useClaimController').default;

const createAddress = (version, fill) => bitGoUTXO.address.toBase58Check(Buffer.alloc(20, fill), version);

const VALID_I_ADDRESS = createAddress(102, 2);
const VALID_R_ADDRESS = createAddress(60, 1);
const VERIFIED_PUBLIC_KEY = `0x04${'11'.repeat(64)}`;

const createDelegatorContract = (overrides = {}) => ({
  callStatic: {
    claimableFees: jest.fn().mockResolvedValue('0'),
    getTokenList: jest.fn().mockResolvedValue([]),
    refunds: jest.fn().mockResolvedValue('0'),
    sendfees: jest.fn().mockResolvedValue(undefined),
    ...overrides.callStatic
  },
  claimRefund: jest.fn(),
  sendfees: jest.fn(),
  ...overrides
});

const HookProbe = () => {
  const controller = useClaimController();

  return (
    <div>
      <div data-testid="earnings-amount">{controller.earningsAmount || ''}</div>
      <div data-testid="earnings-status">{controller.earningsStatus?.message || ''}</div>
      <div data-testid="refund-status">{controller.refundStatus?.message || ''}</div>
      <div data-testid="earnings-pending">{controller.isEarningsLookupPending ? 'pending' : 'ready'}</div>
      <div data-testid="refund-pending">{controller.isRefundLookupPending ? 'pending' : 'ready'}</div>
      <div data-testid="can-claim-earnings">{controller.canClaimEarnings ? 'yes' : 'no'}</div>
      <div data-testid="is-empty-lookup">{controller.isEmptyLookup ? 'yes' : 'no'}</div>
      <div data-testid="wallet-status">{controller.walletAddressStatus?.message || ''}</div>

      <button onClick={() => controller.setAddress(VALID_I_ADDRESS)} type="button">
        Inspect i-address
      </button>
      <button onClick={() => controller.setAddress(VALID_R_ADDRESS)} type="button">
        Inspect R-address
      </button>
      <button onClick={controller.handleWalletAddressAction} type="button">
        Verify wallet
      </button>
    </div>
  );
};

describe('useClaimController', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useWeb3React.mockReturnValue({
      account: '0x1234567890abcdef1234567890abcdef12345678'
    });

    useToast.mockReturnValue({
      addToast: jest.fn()
    });
  });

  test('keeps earnings lookup available while refund token metadata is still loading', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: jest.fn().mockResolvedValue('1000000'),
        getTokenList: jest.fn(() => new Promise(() => {}))
      }
    });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('earnings-amount')).toHaveTextContent('0.01000000');
    });

    expect(screen.getByTestId('earnings-pending')).toHaveTextContent('ready');
    expect(screen.getByTestId('refund-pending')).toHaveTextContent('pending');
  });

  test('does not collapse refund token load failures into the empty state', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: jest.fn().mockResolvedValue('0'),
        getTokenList: jest.fn().mockRejectedValue(new Error('token list unavailable'))
      }
    });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('refund-status')).toHaveTextContent('Refunded assets are temporarily unavailable to inspect.');
    });

    expect(screen.getByTestId('is-empty-lookup')).toHaveTextContent('no');
  });

  test('enables R-address claiming after the connected wallet is verified', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: jest.fn().mockResolvedValue('1000000'),
        getTokenList: jest.fn().mockResolvedValue([])
      }
    });
    useContract.mockReturnValue(delegatorContract);
    requestRefundAddressData.mockResolvedValue({
      publicKey: VERIFIED_PUBLIC_KEY,
      refundAddress: VALID_R_ADDRESS
    });

    render(<HookProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect R-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('can-claim-earnings')).toHaveTextContent('no');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Verify wallet' }));

    await waitFor(() => {
      expect(screen.getByTestId('can-claim-earnings')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected wallet verified for this payout address.');
  });
});
