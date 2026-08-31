import React from 'react';

import { render, screen } from '@testing-library/react';
import {
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  TESTNET
} from 'constants/contractAddress';

import ReferenceTrustlessSection from './ReferenceTrustlessSection';

describe('ReferenceTrustlessSection', () => {
  test('explains the bridge security model and the 2026 exploits without absolute guarantees', () => {
    render(<ReferenceTrustlessSection />);

    expect(screen.getByRole('heading', { name: 'Security without a custodial multisig' })).toBeInTheDocument();
    expect(screen.getByText(
      'No company, operator, or multisig wallet controls the bridge reserves. Cross-chain transfers follow public protocol rules instead of custodial approval.'
    )).toBeInTheDocument();
    expect(screen.getByText(
      'Security is layered across Verus consensus, witnessed notarizations, and the Ethereum contracts. Each layer must validate the same transaction correctly.'
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument();
    expect(screen.getByText('How does the bridge avoid custodial key risk?')).toBeInTheDocument();
    expect(screen.getByText('How are cross-chain transfers verified?')).toBeInTheDocument();
    expect(screen.getByText('What happened in the 2026 bridge exploits?')).toBeInTheDocument();
    expect(screen.getByText('How long does it take for my funds to arrive on Verus?')).toBeInTheDocument();
    expect(screen.getByText('Where can I inspect the Verus-Ethereum Bridge contract?')).toBeInTheDocument();
    expect(screen.getByText('Are the website and the bridge contract open source?')).toBeInTheDocument();
    const etherscanBaseUrl = TESTNET ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';
    const bridgeContractUrl = `${etherscanBaseUrl}/address/${DELEGATOR_ADD}`;

    expect(screen.getByRole('link', { name: bridgeContractUrl }))
      .toHaveAttribute('href', bridgeContractUrl);
    expect(screen.getByRole('link', { name: /github\.com\/VerusCoin\/VerusBridgeWebsite/i }))
      .toHaveAttribute('href', 'https://github.com/VerusCoin/VerusBridgeWebsite');
    expect(screen.getByRole('link', { name: /github\.com\/VerusCoin\/Verus-Ethereum-Contracts/i }))
      .toHaveAttribute('href', 'https://github.com/VerusCoin/Verus-Ethereum-Contracts');
    expect(screen.getByText(new RegExp(`${ETHEREUM_BLOCKCHAIN_NAME} confirmation times and gas conditions`)))
      .toBeInTheDocument();
    expect(screen.getByText(/the Ethereum contracts accepted invalid claims/i)).toBeInTheDocument();
    expect(screen.getByText(/the Verus protocol and Ethereum contracts were upgraded with hardened validation/i))
      .toBeInTheDocument();
    expect(screen.getByText(/underwent code review, regression testing, and fuzzing before the bridge reopened/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/no entity can steal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you'd need to simultaneously compromise the majority/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/decentralized consensus removes custodial key risk/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Who can move my funds?')).not.toBeInTheDocument();
    expect(screen.queryByText('Who verifies each transaction?')).not.toBeInTheDocument();
    expect(screen.queryByText('Where do I go for claims, NFT bridging, and contract inspection?')).not.toBeInTheDocument();
  });
});
