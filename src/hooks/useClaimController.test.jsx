import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';

import { useToast } from 'components/Toast/ToastProvider';
import { EXPECTED_ETHEREUM_CHAIN_ID, TESTNET } from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { requestRefundAddressData } from 'utils/refundAddress';
import { toBase58Check } from 'utils/verusAddress';

import useClaimController from './useClaimController';

vi.mock('@web3-react/core', () => ({
  useWeb3React: vi.fn()
}));

vi.mock('components/Toast/ToastProvider', () => ({
  useToast: vi.fn()
}));

vi.mock('hooks/useContract', () => ({ default: vi.fn() }));

vi.mock('utils/refundAddress', () => ({
  requestRefundAddressData: vi.fn()
}));

const createAddress = (version, fill) => toBase58Check(Buffer.alloc(20, fill), version);

const VALID_I_ADDRESS = createAddress(102, 2);
const VALID_R_ADDRESS = createAddress(60, 1);
const VERIFIED_PUBLIC_KEY = `0x04${'11'.repeat(64)}`;
const REFUNDABLE_TOKEN = {
  erc20ContractAddress: '0x0000000000000000000000000000000000000011',
  flags: '0',
  iaddress: '0x00000000000000000000000000000000000000a1',
  name: 'DAI',
  ticker: 'DAI'
};
const PARTIALLY_UNAVAILABLE_TOKEN = {
  erc20ContractAddress: '0x0000000000000000000000000000000000000022',
  flags: '0',
  iaddress: '0x00000000000000000000000000000000000000b2',
  name: 'USDC',
  ticker: 'USDC'
};
const library = {
  getCode: vi.fn().mockResolvedValue('0x60006000'),
  getNetwork: vi.fn().mockResolvedValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID })
};

const createDelegatorContract = (overrides = {}) => ({
  callStatic: {
    claimableFees: vi.fn().mockResolvedValue('0'),
    getTokenList: vi.fn().mockResolvedValue([]),
    refunds: vi.fn().mockResolvedValue('0'),
    sendfees: vi.fn().mockResolvedValue(undefined),
    ...overrides.callStatic
  },
  claimRefund: vi.fn(),
  sendfees: vi.fn(),
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
      <div data-testid="wallet-verification-required">
        {controller.isWalletVerificationRequired ? 'yes' : 'no'}
      </div>
      <div data-testid="action-target">{controller.actionTarget}</div>
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
      <button onClick={controller.handleClaimEarnings} type="button">
        Claim earnings
      </button>
    </div>
  );
};

const mainnetTest = TESTNET ? test.skip : test;
const testnetTest = TESTNET ? test : test.skip;

describe('useClaimController', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useWeb3React.mockReturnValue({
      account: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      library
    });

    useToast.mockReturnValue({
      addToast: vi.fn()
    });
  });

  mainnetTest('keeps earnings lookup available while refund token metadata is still loading', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('1000000'),
        getTokenList: vi.fn(() => new Promise(() => {}))
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
        claimableFees: vi.fn().mockResolvedValue('0'),
        getTokenList: vi.fn().mockRejectedValue(new Error('token list unavailable'))
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

  test('surfaces a refund inspection error when all token refund lookups fail', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('0'),
        getTokenList: vi.fn().mockResolvedValue([REFUNDABLE_TOKEN]),
        refunds: vi.fn().mockRejectedValue(new Error('rpc unavailable'))
      }
    });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('refund-status')).toHaveTextContent('Unable to inspect refunded assets right now.');
    });

    expect(screen.getByTestId('is-empty-lookup')).toHaveTextContent('no');
  });

  test('keeps detected refunds visible when only some token refund lookups fail', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('0'),
        getTokenList: vi.fn().mockResolvedValue([REFUNDABLE_TOKEN, PARTIALLY_UNAVAILABLE_TOKEN]),
        refunds: vi.fn((address, currency) => {
          if (currency === REFUNDABLE_TOKEN.iaddress) {
            return Promise.resolve('1000000');
          }

          return Promise.reject(new Error('rpc unavailable'));
        })
      }
    });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('refund-status')).toHaveTextContent(
        'Found 1 refundable asset for this address. Some assets could not be inspected right now.'
      );
    });
  });

  mainnetTest('enables R-address claiming after the connected wallet is verified', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('1000000'),
        getTokenList: vi.fn().mockResolvedValue([])
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

  mainnetTest('rechecks the live chain before submitting an earnings transaction', async () => {
    const wrongChainId = EXPECTED_ETHEREUM_CHAIN_ID === 1 ? 11155111 : 1;
    const changingLibrary = {
      getCode: vi.fn().mockResolvedValue('0x60006000'),
      getNetwork: vi.fn()
        .mockResolvedValueOnce({ chainId: EXPECTED_ETHEREUM_CHAIN_ID })
        .mockResolvedValueOnce({ chainId: wrongChainId })
    };
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('1000000'),
        sendfees: vi.fn().mockResolvedValue(undefined)
      },
      sendfees: vi.fn()
    });
    const addToast = vi.fn();

    useWeb3React.mockReturnValue({
      account: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      library: changingLibrary
    });
    useToast.mockReturnValue({ addToast });
    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('can-claim-earnings')).toHaveTextContent('yes');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Claim earnings' }));

    await waitFor(() => {
      expect(delegatorContract.callStatic.sendfees).toHaveBeenCalledTimes(1);
    });

    expect(delegatorContract.sendfees).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringMatching(/Switch MetaMask/),
      type: 'error'
    }));
  });

  testnetTest('uses refund-only lookup state and never inspects or claims earnings', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('1000000'),
        getTokenList: vi.fn().mockResolvedValue([REFUNDABLE_TOKEN]),
        refunds: vi.fn().mockResolvedValue('0'),
        sendfees: vi.fn().mockResolvedValue(undefined)
      },
      sendfees: vi.fn()
    });

    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect i-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('refund-status')).toHaveTextContent(
        'No refunded assets detected for this address.'
      );
    });

    expect(screen.getByTestId('is-empty-lookup')).toHaveTextContent('yes');
    expect(screen.getByTestId('earnings-amount')).toBeEmptyDOMElement();
    expect(screen.getByTestId('earnings-status')).toBeEmptyDOMElement();
    expect(screen.getByTestId('can-claim-earnings')).toHaveTextContent('no');
    expect(delegatorContract.callStatic.claimableFees).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Claim earnings' }));

    expect(screen.getByTestId('action-target')).toBeEmptyDOMElement();
    expect(delegatorContract.callStatic.sendfees).not.toHaveBeenCalled();
    expect(delegatorContract.sendfees).not.toHaveBeenCalled();
  });

  testnetTest('inspects R-address refunds without wallet verification or earnings calls', async () => {
    const delegatorContract = createDelegatorContract({
      callStatic: {
        claimableFees: vi.fn().mockResolvedValue('1000000'),
        getTokenList: vi.fn().mockResolvedValue([REFUNDABLE_TOKEN]),
        refunds: vi.fn().mockResolvedValue('250000000')
      }
    });

    useContract.mockReturnValue(delegatorContract);

    render(<HookProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect R-address' }));

    await waitFor(() => {
      expect(screen.getByTestId('refund-status')).toHaveTextContent(
        'Found 1 refundable asset for this address.'
      );
    });

    expect(delegatorContract.callStatic.refunds).toHaveBeenCalledTimes(1);
    expect(delegatorContract.callStatic.claimableFees).not.toHaveBeenCalled();
    expect(requestRefundAddressData).not.toHaveBeenCalled();
    expect(screen.getByTestId('wallet-verification-required')).toHaveTextContent('no');
    expect(screen.getByTestId('earnings-amount')).toBeEmptyDOMElement();
    expect(screen.getByTestId('earnings-status')).toBeEmptyDOMElement();
    expect(screen.getByTestId('can-claim-earnings')).toHaveTextContent('no');
  });
});
