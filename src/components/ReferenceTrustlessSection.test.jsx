import React from 'react';

import { render, screen } from '@testing-library/react';

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
    expect(screen.getByRole('link', { name: /etherscan\.io\/address\/0x71518580f36FeCEFfE0721F06bA4703218cD7F63/i }))
      .toHaveAttribute('href', 'https://etherscan.io/address/0x71518580f36FeCEFfE0721F06bA4703218cD7F63');
    expect(screen.getByRole('link', { name: /github\.com\/VerusCoin\/VerusBridgeWebsite/i }))
      .toHaveAttribute('href', 'https://github.com/VerusCoin/VerusBridgeWebsite');
    expect(screen.getByRole('link', { name: /github\.com\/VerusCoin\/Verus-Ethereum-Contracts/i }))
      .toHaveAttribute('href', 'https://github.com/VerusCoin/Verus-Ethereum-Contracts');
    expect(screen.queryByText('Who can move my funds?')).not.toBeInTheDocument();
    expect(screen.queryByText('Who verifies each transaction?')).not.toBeInTheDocument();
    expect(screen.queryByText('Where do I go for claims, NFT bridging, and contract inspection?')).not.toBeInTheDocument();
  });
});
