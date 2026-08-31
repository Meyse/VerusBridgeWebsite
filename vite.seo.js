import fs from 'node:fs/promises';
import path from 'node:path';

import { SITE_METADATA } from './src/config/siteMetadata.js';

export const OFFICIAL_SITE_ORIGIN = 'https://eth.verusbridge.io';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const insertBeforeHeadEnd = (html, tags) => html.replace(
  /^[ \t]*<\/head>/m,
  `${tags}\n  </head>`
);

const replaceOrInsertHeadTag = (html, pattern, tag) => pattern.test(html)
  ? html.replace(pattern, tag)
  : insertBeforeHeadEnd(html, `    ${tag}`);

const removeHeadTag = (html, pattern) => html.replace(pattern, '');

export const resolveSearchPublishingPolicy = (bridgeEnvironment, environment = {}) => {
  const indexingSetting = environment.REACT_APP_SEARCH_INDEXING_ENABLED || 'false';
  if (!['false', 'true'].includes(indexingSetting)) {
    throw new Error('REACT_APP_SEARCH_INDEXING_ENABLED must be exactly true or false.');
  }

  const indexingEnabled = indexingSetting === 'true';

  if (!indexingEnabled) {
    return {
      indexingEnabled: false,
      robotsDirective: 'noindex, nofollow',
      siteOrigin: ''
    };
  }

  if (bridgeEnvironment !== 'mainnet') {
    throw new Error('Search indexing can only be enabled for the mainnet build.');
  }

  if (!environment.REACT_APP_PUBLIC_SITE_URL) {
    throw new Error('REACT_APP_PUBLIC_SITE_URL is required when search indexing is enabled.');
  }

  let publicSiteUrl;
  try {
    publicSiteUrl = new URL(environment.REACT_APP_PUBLIC_SITE_URL);
  } catch {
    throw new Error('REACT_APP_PUBLIC_SITE_URL must be the official site URL.');
  }

  const isOriginOnly = publicSiteUrl.pathname === '/'
    && !publicSiteUrl.search
    && !publicSiteUrl.hash
    && !publicSiteUrl.username
    && !publicSiteUrl.password;
  if (!isOriginOnly || publicSiteUrl.origin !== OFFICIAL_SITE_ORIGIN) {
    throw new Error(`Search indexing is restricted to the official site at ${OFFICIAL_SITE_ORIGIN}.`);
  }

  return {
    indexingEnabled: true,
    robotsDirective: 'index, follow',
    siteOrigin: OFFICIAL_SITE_ORIGIN
  };
};

export const renderRouteDocument = (html, metadata, policy) => {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  let renderedHtml = replaceOrInsertHeadTag(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${title}</title>`
  );
  renderedHtml = replaceOrInsertHeadTag(
    renderedHtml,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${description}" />`
  );
  renderedHtml = replaceOrInsertHeadTag(
    renderedHtml,
    /<meta\s+name=["']robots["'][^>]*>/i,
    `<meta name="robots" content="${policy.robotsDirective}" />`
  );
  renderedHtml = replaceOrInsertHeadTag(
    renderedHtml,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${title}" />`
  );
  renderedHtml = replaceOrInsertHeadTag(
    renderedHtml,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${description}" />`
  );
  renderedHtml = removeHeadTag(
    renderedHtml,
    /^[ \t]*<link\s+rel=["']canonical["'][^>]*>[ \t]*\r?\n?/gim
  );
  renderedHtml = removeHeadTag(
    renderedHtml,
    /^[ \t]*<meta\s+property=["']og:url["'][^>]*>[ \t]*\r?\n?/gim
  );

  if (!policy.indexingEnabled) {
    return renderedHtml;
  }

  const canonicalUrl = new URL(metadata.pathname, policy.siteOrigin).toString();
  return insertBeforeHeadEnd(
    renderedHtml,
    `    <link rel="canonical" href="${canonicalUrl}" />\n`
      + `    <meta property="og:url" content="${canonicalUrl}" />`
  );
};

export const createRobotsTxt = (policy) => [
  'User-agent: *',
  'Disallow:',
  ...(policy.indexingEnabled ? [`Sitemap: ${policy.siteOrigin}/sitemap.xml`] : []),
  ''
].join('\n');

export const createSitemapXml = (policy) => {
  if (!policy.indexingEnabled) {
    return null;
  }

  const urls = SITE_METADATA.map(({ pathname }) => (
    `  <url>\n    <loc>${new URL(pathname, policy.siteOrigin).toString()}</loc>\n  </url>`
  )).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    ''
  ].join('\n');
};

export const createSearchPublishingArtifacts = (indexHtml, policy) => {
  const artifacts = SITE_METADATA.slice(1).map((metadata) => ({
    fileName: `${metadata.pathname.slice(1)}.html`,
    source: renderRouteDocument(indexHtml, metadata, policy)
  }));
  artifacts.push({
    fileName: 'robots.txt',
    source: createRobotsTxt(policy)
  });

  const sitemapXml = createSitemapXml(policy);
  if (sitemapXml) {
    artifacts.push({
      fileName: 'sitemap.xml',
      source: sitemapXml
    });
  }

  return artifacts;
};

export const createSearchPublishingPlugin = (policy) => {
  let outputDirectory = '';
  let shouldWriteBuildArtifacts = false;

  return {
    name: 'verus-search-publishing',
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
      shouldWriteBuildArtifacts = config.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/robots.txt') {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end(createRobotsTxt(policy));
      });
    },
    transformIndexHtml(html) {
      return renderRouteDocument(html, SITE_METADATA[0], policy);
    },
    async closeBundle() {
      if (!shouldWriteBuildArtifacts) {
        return;
      }

      const indexHtml = await fs.readFile(path.join(outputDirectory, 'index.html'), 'utf8');
      const artifacts = createSearchPublishingArtifacts(indexHtml, policy);
      await Promise.all(artifacts.map(({ fileName, source }) => (
        fs.writeFile(path.join(outputDirectory, fileName), source, 'utf8')
      )));
    }
  };
};
