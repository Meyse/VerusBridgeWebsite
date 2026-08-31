import { getSiteMetadata } from './src/config/siteMetadata';
import {
  createRobotsTxt,
  createSearchPublishingArtifacts,
  createSearchPublishingPlugin,
  createSitemapXml,
  renderRouteDocument,
  resolveSearchPublishingPolicy
} from './vite.seo';

const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta name="description" content="Old description" />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="Old title" />
    <meta property="og:description" content="Old description" />
    <title>Old title</title>
  </head>
  <body></body>
</html>`;

describe('search publishing policy', () => {
  test('keeps ordinary mainnet and testnet builds out of search by default', () => {
    expect(resolveSearchPublishingPolicy('mainnet', {})).toEqual({
      indexingEnabled: false,
      robotsDirective: 'noindex, nofollow',
      siteOrigin: ''
    });
    expect(resolveSearchPublishingPolicy('testnet', {})).toEqual({
      indexingEnabled: false,
      robotsDirective: 'noindex, nofollow',
      siteOrigin: ''
    });
  });

  test('enables indexing only for an explicit official mainnet build', () => {
    expect(resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_PUBLIC_SITE_URL: 'https://eth.verusbridge.io/',
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    })).toEqual({
      indexingEnabled: true,
      robotsDirective: 'index, follow',
      siteOrigin: 'https://eth.verusbridge.io'
    });
  });

  test('rejects unsafe or ambiguous indexing opt-ins', () => {
    expect(() => resolveSearchPublishingPolicy('testnet', {
      REACT_APP_PUBLIC_SITE_URL: 'https://eth.verusbridge.io',
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    })).toThrow(/mainnet/);
    expect(() => resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_PUBLIC_SITE_URL: 'https://bridge.antafri.com',
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    })).toThrow(/official site/);
    expect(() => resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    })).toThrow(/PUBLIC_SITE_URL/);
    expect(() => resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_SEARCH_INDEXING_ENABLED: 'yes'
    })).toThrow(/true or false/);
  });

  test('renders internal route documents with noindex and no canonical URL', () => {
    const policy = resolveSearchPublishingPolicy('mainnet', {});
    const html = renderRouteDocument(HTML_TEMPLATE, getSiteMetadata('/claim'), policy);

    expect(html).toContain('<title>Bridge Refunds &amp; Earnings | Verus-Ethereum Bridge</title>');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).not.toContain('rel="canonical"');
    expect(createRobotsTxt(policy)).toBe('User-agent: *\nDisallow:\n');
    expect(createSitemapXml(policy)).toBeNull();
  });

  test('publishes canonical route documents and a sitemap for the official build', () => {
    const policy = resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_PUBLIC_SITE_URL: 'https://eth.verusbridge.io',
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    });
    const html = renderRouteDocument(HTML_TEMPLATE, getSiteMetadata('/nft'), policy);

    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain('<link rel="canonical" href="https://eth.verusbridge.io/nft" />');
    expect(html).toContain('<meta property="og:url" content="https://eth.verusbridge.io/nft" />');
    expect(createRobotsTxt(policy)).toBe([
      'User-agent: *',
      'Disallow:',
      'Sitemap: https://eth.verusbridge.io/sitemap.xml',
      ''
    ].join('\n'));
    expect(createSitemapXml(policy)).toContain('<loc>https://eth.verusbridge.io/claim</loc>');
  });

  test('emits route-specific HTML and crawler-control files through the Vite build seam', () => {
    const policy = resolveSearchPublishingPolicy('mainnet', {
      REACT_APP_PUBLIC_SITE_URL: 'https://eth.verusbridge.io',
      REACT_APP_SEARCH_INDEXING_ENABLED: 'true'
    });
    const plugin = createSearchPublishingPlugin(policy);
    const indexHtml = plugin.transformIndexHtml(HTML_TEMPLATE);
    const emittedFiles = new Map(
      createSearchPublishingArtifacts(indexHtml, policy).map((file) => [file.fileName, file.source])
    );

    expect(emittedFiles.get('claim.html')).toContain('<title>Bridge Refunds &amp; Earnings');
    expect(emittedFiles.get('nft.html')).toContain('href="https://eth.verusbridge.io/nft"');
    expect(emittedFiles.get('robots.txt')).toContain('Sitemap: https://eth.verusbridge.io/sitemap.xml');
    expect(emittedFiles.get('sitemap.xml')).toContain('<loc>https://eth.verusbridge.io/</loc>');
  });
});
