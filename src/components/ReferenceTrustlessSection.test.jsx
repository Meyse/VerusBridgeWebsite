import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ReferenceTrustlessSection from './ReferenceTrustlessSection';

const resources = [
  {
    id: 'claim',
    title: 'Claim / Refunds',
    description: 'Recover claimable fees or refund balances with the live bridge recovery route.',
    to: '/claim'
  },
  {
    id: 'contract',
    title: 'Bridge contract',
    description: 'Inspect the live delegator contract and transaction history.',
    href: 'https://etherscan.io/address/0x1234'
  }
];

describe('ReferenceTrustlessSection', () => {
  test('renders FAQ accordions and keeps the recovery resources inside the FAQ', () => {
    render(
      <MemoryRouter>
        <ReferenceTrustlessSection resources={resources} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument();
    expect(screen.getByText('Why do most bridges fail?')).toBeInTheDocument();
    expect(screen.getByText('What makes the Verus-Ethereum Bridge different?')).toBeInTheDocument();
    expect(screen.queryByText('Helpful links')).not.toBeInTheDocument();
    expect(screen.queryByText('Traditional Bridges')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Where do I go for claims, NFT bridging, and contract inspection?'));

    expect(screen.getByRole('link', { name: /Claim \/ Refunds/i })).toHaveAttribute('href', '/claim');
    expect(screen.getByRole('link', { name: /Bridge contract/i })).toHaveAttribute(
      'href',
      'https://etherscan.io/address/0x1234'
    );
  });
});
