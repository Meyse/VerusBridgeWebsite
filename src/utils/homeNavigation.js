export const HOME_ROUTE_PATH = '/';
export const HOME_REVIEW_STEP = 'review';
export const HOME_INFO_SECTION_ID = 'info';
export const HOME_INFO_HASH = `#${HOME_INFO_SECTION_ID}`;
export const HOME_BRIDGE_INTERFACE_ID = 'bridge-interface';
export const HOME_BRIDGE_INTERFACE_HASH = `#${HOME_BRIDGE_INTERFACE_ID}`;

export const getHomeStep = (search = '') => {
  const searchParams = new URLSearchParams(search);
  const step = searchParams.get('step');

  return step === HOME_REVIEW_STEP ? HOME_REVIEW_STEP : null;
};

export const hasNonCanonicalHomeStep = (search = '') => {
  const searchParams = new URLSearchParams(search);
  const step = searchParams.get('step');

  return step !== null && step !== HOME_REVIEW_STEP;
};

export const normalizeHomeHash = (hash = '') => {
  if (hash === HOME_BRIDGE_INTERFACE_HASH || hash === HOME_INFO_HASH) {
    return hash;
  }

  return '';
};

export const buildHomeLocation = ({ hash = '', search = '', step = null } = {}) => {
  const searchParams = new URLSearchParams(search);

  if (step) {
    searchParams.set('step', step);
  } else {
    searchParams.delete('step');
  }

  const nextSearch = searchParams.toString();

  return {
    hash,
    pathname: HOME_ROUTE_PATH,
    search: nextSearch ? `?${nextSearch}` : ''
  };
};

export const buildHomeHref = (options = {}) => {
  const nextLocation = buildHomeLocation(options);

  return `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`;
};

export const scrollToHomeSection = (sectionId) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const targetNode = document.getElementById(sectionId);
  if (!targetNode) {
    return false;
  }

  window.requestAnimationFrame(() => {
    targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  return true;
};
