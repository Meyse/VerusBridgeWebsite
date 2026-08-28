import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TESTNET } from 'constants/contractAddress';

import NFT from './NFT';

vi.mock('components/NFTForm/NFTForm', () => ({
  __esModule: true,
  default: () => <div data-testid="nft-form" />
}));

vi.mock('components/SiteFooter', () => ({
  __esModule: true,
  default: () => <footer data-testid="site-footer" />
}));

vi.mock('components/SiteHeader', () => ({
  __esModule: true,
  default: () => <header data-testid="site-header" />
}));

describe('NFT page', () => {
  test('uses the claim label for the active bridge profile', () => {
    render(
      <MemoryRouter>
        <NFT />
      </MemoryRouter>
    );

    const claimLabel = TESTNET ? 'Refunds' : 'Refunds & earnings';

    expect(screen.getByRole('link', { name: claimLabel })).toHaveAttribute('href', '/claim');
    expect(screen.queryByRole('link', {
      name: TESTNET ? 'Refunds & earnings' : 'Refunds'
    })).not.toBeInTheDocument();
  });
});
