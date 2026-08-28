import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TESTNET } from 'constants/contractAddress';
import useClaimController from 'hooks/useClaimController';

import Claim from './Claim';

vi.mock('components/SiteHeader', () => ({
  __esModule: true,
  default: () => <header data-testid="site-header" />
}));

vi.mock('hooks/useClaimController', () => ({
  __esModule: true,
  default: vi.fn()
}));

vi.mock('utils/bridgeUi', () => ({
  getCurrencyIcon: () => '/icons/currencies/placeholder.svg'
}));

const createController = (overrides = {}) => ({
  account: '0x1234567890abcdef1234567890abcdef12345678',
  actionTarget: '',
  address: 'iAddress123456789012345678901234567890',
  addressError: '',
  canClaimEarnings: true,
  earningsAmount: '0.12500000',
  earningsActionLabel: 'Claim back to this Verus address',
  earningsClaimHelp: 'Claims for an i-address are bridged back to this Verus address.',
  earningsStatus: {
    severity: 'info',
    message: '0.12500000 ETH is ready to claim as bridgekeeper earnings.'
  },
  handleClaimEarnings: vi.fn(),
  handleClaimRefund: vi.fn(),
  handleWalletAddressAction: vi.fn(),
  hasAnyResults: true,
  hasLookup: true,
  isActionPending: false,
  isEarningsLookupPending: false,
  isEmptyLookup: false,
  isLookupPending: false,
  isRefundLookupPending: false,
  isWalletLinkedAddress: false,
  isWalletAddressPending: false,
  isWalletVerificationRequired: false,
  refundEntries: [{
    amount: '2.50000000',
    name: 'VRSC',
    value: 'iVrscToken'
  }],
  refundStatus: {
    severity: 'info',
    message: 'Found 1 refundable asset for this address.'
  },
  setAddress: vi.fn(),
  walletActionLabel: 'Use connected wallet',
  walletAddressStatus: null,
  ...overrides
});

const renderPage = () => render(
  <MemoryRouter>
    <Claim />
  </MemoryRouter>
);

const mainnetTest = TESTNET ? test.skip : test;

describe('Claim page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the claim experience for the active bridge profile', () => {
    const controller = createController();
    useClaimController.mockReturnValue(controller);

    renderPage();

    expect(screen.queryByRole('heading', { name: 'Refunds & earnings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste address' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use connected wallet' })).toBeInTheDocument();
    expect(screen.getByText('Refunded assets', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim VRSC to this address' })).toBeInTheDocument();
    expect(screen.queryByText('How this page works')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced payout options')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to bridge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'NFT bridge' })).not.toBeInTheDocument();
    expect(screen.queryByText('Connected wallet')).not.toBeInTheDocument();
    expect(screen.queryByText('0x1234...5678')).not.toBeInTheDocument();
    expect(screen.queryByText('Claim / Refunds')).not.toBeInTheDocument();
    expect(screen.queryByText('Use your public key to claim')).not.toBeInTheDocument();
    expect(screen.queryByText('Claim a refund balance')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'FAQ' })).not.toBeInTheDocument();
    expect(screen.getByText('How can I claim funds that are stuck?')).toBeInTheDocument();

    if (TESTNET) {
      expect(screen.queryByText('Bridgekeeper earnings', { selector: 'span' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Claim back to this Verus address' })).not.toBeInTheDocument();
      expect(screen.queryByText('How can I earn money with the Verus-Ethereum Bridge?')).not.toBeInTheDocument();
      expect(screen.queryByText('How can I claim bridge earnings?')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Bridgekeeper earnings', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Claim back to this Verus address' })).toBeInTheDocument();
      expect(screen.getByText('How can I earn money with the Verus-Ethereum Bridge?')).toBeInTheDocument();
      expect(screen.getByText('How can I claim bridge earnings?')).toBeInTheDocument();
    }

    fireEvent.change(screen.getByPlaceholderText(/enter your verus i-address or r-address/i), {
      target: { value: 'iNextAddress1234567890123456789012345' }
    });

    expect(controller.setAddress).toHaveBeenCalledWith('iNextAddress1234567890123456789012345');

    fireEvent.click(screen.getByRole('button', { name: 'Use connected wallet' }));

    expect(controller.handleWalletAddressAction).toHaveBeenCalled();
  });

  test('renders the empty-state panel when nothing is ready to recover', () => {
    useClaimController.mockReturnValue(createController({
      earningsAmount: '0.00000000',
      earningsStatus: {
        severity: 'info',
        message: 'No bridgekeeper earnings detected for this address yet.'
      },
      hasAnyResults: false,
      isEmptyLookup: true,
      refundEntries: [],
      refundStatus: {
        severity: 'info',
        message: 'No refunded assets detected for this address.'
      }
    }));

    renderPage();

    expect(screen.getByText('Nothing ready for this address')).toBeInTheDocument();
    expect(screen.getByText(
      TESTNET
        ? 'No refunded assets are available to claim right now.'
        : 'No bridgekeeper earnings or refunded assets are available to claim right now.'
    )).toBeInTheDocument();
    expect(screen.queryByText('Bridgekeeper earnings', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.queryByText('Refunded assets', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.queryByText(/No bridgekeeper earnings detected for this address yet/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/No refunded assets detected for this address/i))
      .not.toBeInTheDocument();
  });

  test('shows refund lookup warnings instead of the empty success state', () => {
    useClaimController.mockReturnValue(createController({
      earningsAmount: '0.00000000',
      earningsStatus: {
        severity: 'info',
        message: 'No bridgekeeper earnings detected for this address yet.'
      },
      hasAnyResults: false,
      isEmptyLookup: false,
      refundEntries: [],
      refundStatus: {
        severity: 'warning',
        message: 'Refunded assets are temporarily unavailable to inspect.'
      }
    }));

    renderPage();

    expect(screen.queryByText('Nothing ready for this address')).not.toBeInTheDocument();
    expect(screen.getByText('Refunded assets', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Refunded assets are temporarily unavailable to inspect.')).toBeInTheDocument();
  });

  mainnetTest('keeps R-address earnings disabled until the connected wallet is verified', () => {
    useClaimController.mockReturnValue(createController({
      address: 'RRandomPayoutAddress1234567890123456789',
      canClaimEarnings: false,
      earningsActionLabel: 'Verify connected wallet to claim',
      earningsAmount: '0.02998092',
      earningsClaimHelp: 'Verify the connected wallet before claiming this R-address.',
      isWalletVerificationRequired: true,
      walletActionLabel: 'Verify connected wallet'
    }));

    renderPage();

    expect(screen.getByRole('button', { name: 'Verify connected wallet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify connected wallet to claim' })).toBeDisabled();
  });

  mainnetTest('hides the verification action once the connected wallet matches the R-address', () => {
    useClaimController.mockReturnValue(createController({
      address: 'RVerifiedPayoutAddress12345678901234567',
      canClaimEarnings: true,
      earningsActionLabel: 'Claim to connected Ethereum wallet',
      earningsAmount: '0.02998092',
      earningsClaimHelp: 'This payout address matches the connected wallet.',
      isWalletLinkedAddress: true,
      isWalletVerificationRequired: true,
      walletActionLabel: 'Connected wallet verified'
    }));

    renderPage();

    expect(screen.queryByRole('button', { name: 'Connected wallet verified' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim to connected Ethereum wallet' })).toBeInTheDocument();
  });
});
