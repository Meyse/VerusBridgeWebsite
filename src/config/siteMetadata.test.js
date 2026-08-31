import { getSiteMetadata } from './siteMetadata';

describe('site metadata', () => {
  test('describes each public route with distinct search metadata', () => {
    expect(getSiteMetadata('/')).toEqual({
      description: 'Move supported assets between Ethereum and Verus with the non-custodial Verus-Ethereum Bridge.',
      pathname: '/',
      title: 'Verus-Ethereum Bridge | Bridge Assets to Verus'
    });
    expect(getSiteMetadata('/claim')).toEqual({
      description: 'Check a Verus address for Bridgekeeper earnings or refunded bridge assets, then claim them with the matching Ethereum wallet.',
      pathname: '/claim',
      title: 'Bridge Refunds & Earnings | Verus-Ethereum Bridge'
    });
    expect(getSiteMetadata('/nft')).toEqual({
      description: 'Move supported ERC-721 and ERC-1155 assets between Ethereum and Verus.',
      pathname: '/nft',
      title: 'NFT Bridge | Verus-Ethereum Bridge'
    });
    expect(getSiteMetadata('/unknown')).toBeNull();
  });
});
