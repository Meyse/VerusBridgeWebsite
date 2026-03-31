import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import BridgeHomePage from './BridgeHomePage';

jest.mock('components/BridgeCard', () => ({
  __esModule: true,
  default: () => <div data-testid="bridge-card" />
}));

jest.mock('components/ReferenceInfoBar', () => ({
  __esModule: true,
  default: () => <div data-testid="info-bar" />
}));

jest.mock('components/ReferenceTrustlessSection', () => ({
  __esModule: true,
  default: () => <section data-testid="trust-section" />
}));

jest.mock('components/SiteHeader', () => ({
  __esModule: true,
  default: () => <header data-testid="site-header" />
}));

jest.mock('config/explorerLinks', () => ({
  getExplorerResources: () => []
}));

jest.mock('hooks/useBridgeController', () => ({
  __esModule: true,
  default: () => ({
    baseBridgeFeeValue: 0,
    bounceBackFeeValue: 0,
    ethUsdPrice: 0,
    notarizationLagBlocks: 0,
    notarizationLagSeconds: 0,
    verusChainHeight: 0,
    verusTipHeight: 0
  })
}));

describe('BridgeHomePage', () => {
  test('renders the header outside the hero section so it can stay sticky across the page', () => {
    const { container } = render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    const page = container.firstElementChild;
    const header = screen.getByTestId('site-header');

    expect(page.firstElementChild).toBe(header);
    expect(header.parentElement).toBe(page);
  });
});
