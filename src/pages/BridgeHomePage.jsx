import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import BridgeCard from 'components/BridgeCard';
import ReferenceInfoBar from 'components/ReferenceInfoBar';
import ReferenceTrustlessSection from 'components/ReferenceTrustlessSection';
import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';
import {
  ETHEREUM_NATIVE_ASSET_NAME,
  VERUS_NATIVE_ASSET_NAME
} from 'constants/contractAddress';
import useBridgeController from 'hooks/useBridgeController';
import {
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
        search: location.search,
        step: HOME_REVIEW_STEP
      })
    );
  }, [location.search, navigate]);

  const exitReview = useCallback(({ hash = '' } = {}) => {
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
                <h1 className={styles.title}>Bridge assets to Verus</h1>
              </div>
            ) : null}

            <div className={styles.formCenter}>
              <BridgeCard controller={controller} />
              {!isReviewing ? (
                <p className={styles.supportingText}>
                  Move assets between {ETHEREUM_NATIVE_ASSET_NAME} and {VERUS_NATIVE_ASSET_NAME} through the Verus-Ethereum Bridge.
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
      {!isReviewing ? <SiteFooter /> : null}
    </div>
  );
};

export default BridgeHomePage;
