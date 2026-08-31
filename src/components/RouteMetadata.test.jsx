import React from 'react';

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import RouteMetadata from './RouteMetadata';

describe('RouteMetadata', () => {
  test('keeps internal routes out of search while updating their descriptive metadata', async () => {
    document.head.innerHTML = '<link rel="canonical" href="https://old.example/" />';

    render(
      <MemoryRouter initialEntries={['/claim']}>
        <RouteMetadata />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('Bridge Refunds & Earnings | Verus-Ethereum Bridge');
    });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Check a Verus address for Bridgekeeper earnings or refunded bridge assets, then claim them with the matching Ethereum wallet.'
    );
    expect(document.querySelector('link[rel="canonical"]')).not.toBeInTheDocument();
  });

  test('sets the route canonical URL only for an indexable official deployment', async () => {
    render(
      <MemoryRouter initialEntries={['/nft']}>
        <RouteMetadata indexingEnabled siteOrigin="https://eth.verusbridge.io" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://eth.verusbridge.io/nft'
      );
    });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://eth.verusbridge.io/nft'
    );
  });
});
