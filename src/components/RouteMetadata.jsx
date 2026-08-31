import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import {
  getSiteMetadata,
  SOCIAL_IMAGE_METADATA
} from 'config/siteMetadata';

const setMetaContent = (attribute, key, content) => {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const removeHeadElement = (selector) => document.head.querySelector(selector)?.remove();

const setCanonicalUrl = (href) => {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const RouteMetadata = ({
  indexingEnabled = process.env.REACT_APP_SEARCH_INDEXING_ENABLED === 'true',
  siteOrigin = process.env.REACT_APP_PUBLIC_SITE_URL || ''
}) => {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getSiteMetadata(pathname);
    if (!metadata) {
      document.title = 'Page not found | Verus-Ethereum Bridge';
      setMetaContent('name', 'robots', 'noindex, nofollow');
      removeHeadElement('link[rel="canonical"]');
      removeHeadElement('meta[property="og:url"]');
      return;
    }

    document.title = metadata.title;
    setMetaContent('name', 'description', metadata.description);
    setMetaContent('property', 'og:title', metadata.title);
    setMetaContent('property', 'og:description', metadata.description);
    setMetaContent('property', 'og:image:width', String(SOCIAL_IMAGE_METADATA.width));
    setMetaContent('property', 'og:image:height', String(SOCIAL_IMAGE_METADATA.height));

    if (!indexingEnabled || !siteOrigin) {
      setMetaContent('property', 'og:image', SOCIAL_IMAGE_METADATA.pathname);
      setMetaContent('name', 'robots', 'noindex, nofollow');
      removeHeadElement('link[rel="canonical"]');
      removeHeadElement('meta[property="og:url"]');
      return;
    }

    const canonicalUrl = new URL(metadata.pathname, siteOrigin).toString();
    const socialImageUrl = new URL(SOCIAL_IMAGE_METADATA.pathname, siteOrigin).toString();
    setMetaContent('name', 'robots', 'index, follow');
    setMetaContent('property', 'og:image', socialImageUrl);
    setMetaContent('property', 'og:url', canonicalUrl);
    setCanonicalUrl(canonicalUrl);
  }, [indexingEnabled, pathname, siteOrigin]);

  return null;
};

export default RouteMetadata;
