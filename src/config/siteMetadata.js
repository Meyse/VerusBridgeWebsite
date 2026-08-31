const siteMetadataByPathname = Object.freeze({
  '/': Object.freeze({
    description: 'Move supported assets between Ethereum and Verus with the non-custodial Verus-Ethereum Bridge.',
    pathname: '/',
    title: 'Verus-Ethereum Bridge | Bridge Assets to Verus'
  }),
  '/claim': Object.freeze({
    description: 'Check a Verus address for Bridgekeeper earnings or refunded bridge assets, then claim them with the matching Ethereum wallet.',
    pathname: '/claim',
    title: 'Bridge Refunds & Earnings | Verus-Ethereum Bridge'
  }),
  '/nft': Object.freeze({
    description: 'Move supported ERC-721 and ERC-1155 assets between Ethereum and Verus.',
    pathname: '/nft',
    title: 'NFT Bridge | Verus-Ethereum Bridge'
  })
});

export const SITE_METADATA = Object.freeze(Object.values(siteMetadataByPathname));

export const getSiteMetadata = (pathname) => siteMetadataByPathname[pathname] || null;
