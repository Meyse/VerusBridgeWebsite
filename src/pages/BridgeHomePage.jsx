import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import BridgeCard from 'components/BridgeCard';
import ReferenceInfoBar from 'components/ReferenceInfoBar';
import ReferenceTrustlessSection from 'components/ReferenceTrustlessSection';
import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';
import useBridgeController from 'hooks/useBridgeController';
import { getCurrencyIcon } from 'utils/bridgeUi';
import {
  HOME_BRIDGE_INTERFACE_HASH,
  HOME_INFO_SECTION_ID,
  HOME_INFO_HASH,
  HOME_REVIEW_STEP,
  buildHomeLocation,
  getHomeStep,
  hasNonCanonicalHomeStep,
  normalizeHomeHash,
  scrollToHomeSection
} from 'utils/homeNavigation';

import styles from '../styles/ReferenceBridge.module.css';

const ScrollIcon = () => (
  <svg className={styles.scrollIcon} fill="none" viewBox="0 0 24 24">
    <path
      d="M19 9l-7 7-7-7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const SCROLL_INDICATOR_FADE_DISTANCE = 220;
const HERO_TOKEN_DECORATIONS = [
  {
    id: 'vrsc-top-left',
    symbol: 'VRSC',
    size: '104px',
    top: '11%',
    left: '8%',
    opacity: 0.5,
    blur: '13px',
    rotate: '-12deg',
    shiftX: '14px',
    shiftY: '-10px',
    duration: '17s'
  },
  {
    id: 'bridge-top-right',
    symbol: 'BRIDGE',
    size: '96px',
    top: '12%',
    right: '6%',
    opacity: 0.42,
    blur: '14px',
    rotate: '9deg',
    shiftX: '-12px',
    shiftY: '8px',
    duration: '18s'
  },
  {
    id: 'usdc-mid-right',
    symbol: 'USDC',
    size: '78px',
    top: '39%',
    right: '14%',
    opacity: 0.26,
    blur: '12px',
    rotate: '-8deg',
    shiftX: '10px',
    shiftY: '-12px',
    duration: '21s'
  },
  {
    id: 'dai-mid-left',
    symbol: 'DAI',
    size: '92px',
    top: '44%',
    left: '9%',
    opacity: 0.48,
    blur: '11px',
    rotate: '-18deg',
    shiftX: '-10px',
    shiftY: '12px',
    duration: '19s'
  },
  {
    id: 'wbtc-lower-left',
    symbol: 'WBTC',
    size: '84px',
    bottom: '22%',
    left: '18%',
    opacity: 0.4,
    blur: '10px',
    rotate: '11deg',
    shiftX: '12px',
    shiftY: '-9px',
    duration: '20s',
    desktopOnly: true
  },
  {
    id: 'eth-lower-mid',
    symbol: 'ETH',
    size: '94px',
    bottom: '7%',
    left: '28%',
    opacity: 0.32,
    blur: '13px',
    rotate: '8deg',
    shiftX: '-14px',
    shiftY: '-8px',
    duration: '22s',
    desktopOnly: true
  },
  {
    id: 'eurc-lower-right',
    symbol: 'EURC',
    size: '76px',
    bottom: '14%',
    right: '23%',
    opacity: 0.22,
    blur: '12px',
    rotate: '-7deg',
    shiftX: '8px',
    shiftY: '10px',
    duration: '18s',
    desktopOnly: true
  },
  {
    id: 'usdt-corner-right',
    symbol: 'USDT',
    size: '72px',
    bottom: '10%',
    right: '5%',
    opacity: 0.34,
    blur: '11px',
    rotate: '6deg',
    shiftX: '-8px',
    shiftY: '-10px',
    duration: '16s',
    desktopOnly: true
  }
];

const getScrollIndicatorOpacity = () => {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.max(0, 1 - window.scrollY / SCROLL_INDICATOR_FADE_DISTANCE);
};

const BridgeHomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(getScrollIndicatorOpacity);
  const homeStep = useMemo(() => getHomeStep(location.search), [location.search]);
  const isReviewRequested = homeStep === HOME_REVIEW_STEP;
  const hasInvalidHomeStep = useMemo(() => hasNonCanonicalHomeStep(location.search), [location.search]);
  const normalizedHash = useMemo(() => normalizeHomeHash(location.hash), [location.hash]);

  const enterReview = useCallback(() => {
    navigate(
      buildHomeLocation({
        hash: HOME_BRIDGE_INTERFACE_HASH,
        search: location.search,
        step: HOME_REVIEW_STEP
      })
    );
  }, [location.search, navigate]);

  const exitReview = useCallback(({ hash = HOME_BRIDGE_INTERFACE_HASH } = {}) => {
    navigate(
      buildHomeLocation({
        hash,
        search: location.search
      }),
      { replace: true }
    );
  }, [location.search, navigate]);

  const controller = useBridgeController({
    enterReview,
    exitReview,
    isReviewRequested
  });

  useEffect(() => {
    if (!hasInvalidHomeStep) {
      return;
    }

    navigate(
      buildHomeLocation({
        hash: normalizedHash,
        search: location.search
      }),
      { replace: true }
    );
  }, [hasInvalidHomeStep, location.search, navigate, normalizedHash]);

  useEffect(() => {
    if (!isReviewRequested || controller.hasReviewSnapshot) {
      return;
    }

    navigate(
      buildHomeLocation({
        hash: normalizedHash,
        search: location.search
      }),
      { replace: true }
    );
  }, [controller.hasReviewSnapshot, isReviewRequested, location.search, navigate, normalizedHash]);

  useEffect(() => {
    if (!location.hash || hasInvalidHomeStep || (isReviewRequested && !controller.hasReviewSnapshot)) {
      return;
    }

    if (location.hash === HOME_INFO_HASH && isReviewRequested) {
      return;
    }

    scrollToHomeSection(location.hash.replace('#', ''));
  }, [controller.hasReviewSnapshot, hasInvalidHomeStep, isReviewRequested, location.hash]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = null;

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        setScrollIndicatorOpacity(getScrollIndicatorOpacity());
        frameId = null;
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const isReviewing = Boolean(controller.isReviewing);

  return (
    <div className={styles.page}>
      <SiteHeader />

      <div className={styles.hero}>
        {!isReviewing ? (
          <div
            aria-hidden="true"
            className={styles.heroDecor}
            data-testid="hero-token-decor"
          >
            {HERO_TOKEN_DECORATIONS.map((token) => (
              <div
                className={`${styles.heroToken} ${token.desktopOnly ? styles.heroTokenDesktopOnly : ''}`}
                key={token.id}
                style={{
                  top: token.top,
                  right: token.right,
                  bottom: token.bottom,
                  left: token.left,
                  '--hero-token-size': token.size,
                  '--hero-token-opacity': token.opacity,
                  '--hero-token-blur': token.blur,
                  '--hero-token-rotate': token.rotate,
                  '--hero-token-shift-x': token.shiftX,
                  '--hero-token-shift-y': token.shiftY,
                  '--hero-token-duration': token.duration
                }}
              >
                <img alt="" draggable="false" src={getCurrencyIcon(token.symbol)} />
              </div>
            ))}
          </div>
        ) : null}

        <ReferenceInfoBar
          baseBridgeFee={controller.baseBridgeFeeValue}
          bounceBackFee={controller.bounceBackFeeValue}
          ethUsdPrice={controller.ethUsdPrice}
          notarizationHeight={controller.verusChainHeight}
          notarizationLagBlocks={controller.notarizationLagBlocks}
          notarizationLagSeconds={controller.notarizationLagSeconds}
          verusTipHeight={controller.verusTipHeight}
        />

        <main className={styles.main}>
          <div className={styles.content}>
            {!isReviewing ? (
              <div className={styles.titleWrap}>
                <h1 className={styles.title}>Bridge assets securely</h1>
              </div>
            ) : null}

            <div className={styles.formCenter}>
              <BridgeCard controller={controller} />
              {!isReviewing ? (
                <p className={styles.supportingText}>
                  Bridge or convert completely trustless into Verus, or convert back into Ethereum. No counterparty risk.
                </p>
              ) : null}
            </div>
          </div>
        </main>

        {!isReviewing ? (
          <div className={styles.scrollIndicatorWrap}>
            <button
              className={styles.scrollIndicator}
              onClick={() => scrollToHomeSection(HOME_INFO_SECTION_ID)}
              style={{
                opacity: scrollIndicatorOpacity,
                pointerEvents: scrollIndicatorOpacity <= 0.05 ? 'none' : undefined
              }}
              tabIndex={scrollIndicatorOpacity <= 0.05 ? -1 : 0}
              type="button"
            >
              <span className={styles.scrollLabel}>Scroll to learn more</span>
              <ScrollIcon />
            </button>
          </div>
        ) : null}
      </div>

      {!isReviewing ? <ReferenceTrustlessSection /> : null}
      <SiteFooter />
    </div>
  );
};

export default BridgeHomePage;
