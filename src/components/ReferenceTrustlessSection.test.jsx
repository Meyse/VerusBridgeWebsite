import React from 'react';

import { render, screen } from '@testing-library/react';
import {
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  TESTNET
} from 'constants/contractAddress';

import ReferenceTrustlessSection from './ReferenceTrustlessSection';

describe('ReferenceTrustlessSection', () => {
  test('renders the remaining FAQ accordions', () => {
    render(<ReferenceTrustlessSection />);

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument();
    expect(screen.getByText('Why do most bridges fail?')).toBeInTheDocument();
    expect(screen.getByText('What makes the Verus-Ethereum Bridge different?')).toBeInTheDocument();
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
    expect(screen.queryByText('Who can move my funds?')).not.toBeInTheDocument();
    expect(screen.queryByText('Who verifies each transaction?')).not.toBeInTheDocument();
    expect(screen.queryByText('Where do I go for claims, NFT bridging, and contract inspection?')).not.toBeInTheDocument();
  });
});
