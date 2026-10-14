import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from 'react';

import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import BridgeCard from 'components/BridgeCard';
import ReferenceInfoBar from 'components/ReferenceInfoBar';
import ReferenceTrustlessSection from 'components/ReferenceTrustlessSection';
import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';
import {
  ETHEREUM_NATIVE_ASSET_NAME,
  EXPECTED_ETHEREUM_CHAIN_ID,
  VERUS_NATIVE_ASSET_NAME
} from 'constants/contractAddress';
import useBridgeController from 'hooks/useBridgeController';
import { getCurrencyIcon } from 'utils/bridgeUi';
import {
  HOME_INFO_SECTION_ID,
  HOME_INFO_HASH,
  HOME_REVIEW_STEP,
  HOME_STATUS_STEP,
  buildHomeLocation,
  getHomeStep,
  hasNonCanonicalHomeStep,
  normalizeHomeHash,
  scrollToHomeSection
} from 'utils/homeNavigation';
import {
  dismissSendRecord,
  getSendScreenState,
  hasReopenedThisLoad,
  isLiveSendFlow,
  isSendRecordDismissed,
  markReopenedThisLoad
} from 'utils/sendScreenState';
import { pickReopenRecord, shouldOpenLateResult } from 'utils/sendScreens';

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
  { id: 'vrsc-top-left', symbol: 'VRSC', size: '104px', top: '11%', left: '8%', opacity: 0.5, blur: '13px', rotate: '-12deg', shiftX: '14px', shiftY: '-10px', duration: '17s' },
  { id: 'bridge-top-right', symbol: 'BRIDGE', size: '96px', top: '12%', right: '6%', opacity: 0.42, blur: '14px', rotate: '9deg', shiftX: '-12px', shiftY: '8px', duration: '18s' },
  { id: 'usdc-mid-right', symbol: 'USDC', size: '78px', top: '39%', right: '14%', opacity: 0.26, blur: '12px', rotate: '-8deg', shiftX: '10px', shiftY: '-12px', duration: '21s' },
  { id: 'dai-mid-left', symbol: 'DAI', size: '92px', top: '44%', left: '9%', opacity: 0.48, blur: '11px', rotate: '-18deg', shiftX: '-10px', shiftY: '12px', duration: '19s' },
  { id: 'wbtc-lower-left', symbol: 'WBTC', size: '84px', bottom: '22%', left: '18%', opacity: 0.4, blur: '10px', rotate: '11deg', shiftX: '12px', shiftY: '-9px', duration: '20s' },
  { id: 'eth-lower-mid', symbol: 'ETH', size: '94px', bottom: '7%', left: '28%', opacity: 0.32, blur: '13px', rotate: '8deg', shiftX: '-14px', shiftY: '-8px', duration: '22s' },
  { id: 'eurc-lower-right', symbol: 'EURC', size: '76px', bottom: '14%', right: '23%', opacity: 0.22, blur: '12px', rotate: '-7deg', shiftX: '8px', shiftY: '10px', duration: '18s' },
  { id: 'usdt-corner-right', symbol: 'USDT', size: '72px', bottom: '10%', right: '5%', opacity: 0.34, blur: '11px', rotate: '6deg', shiftX: '-8px', shiftY: '-10px', duration: '16s' }
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
  const navigationType = useNavigationType();
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(getScrollIndicatorOpacity);
  const homeStep = useMemo(() => getHomeStep(location.search), [location.search]);
  const hasInvalidHomeStep = useMemo(() => hasNonCanonicalHomeStep(location.search), [location.search]);
  const normalizedHash = useMemo(() => normalizeHomeHash(location.hash), [location.hash]);
  const locationRef = useRef(location);
  // React Router finishes a navigation asynchronously. Until it does, the
  // page renders the step that it navigates to, so the card never shows the
  // old step with the new send state. A newer location ends the pending step.
  const [pendingStep, setPendingStep] = useState(null);
  const pendingStepRef = useRef(null);
  const isNavigationPending = Boolean(pendingStep && pendingStep.fromKey === location.key);
  const effectiveStep = isNavigationPending ? pendingStep.step : homeStep;
  const isReviewRequested = effectiveStep === HOME_REVIEW_STEP;
  const isStatusRequested = effectiveStep === HOME_STATUS_STEP;
  const previousStepRef = useRef(homeStep);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Every navigation of this page.
  const goTo = useCallback((step, { hash = '', replace = false } = {}) => {
    const pending = { fromKey: locationRef.current.key, step };
    pendingStepRef.current = pending;
    setPendingStep(pending);
    navigate(buildHomeLocation({ hash, search: locationRef.current.search, step }), { replace });
  }, [navigate]);

  const getCurrentStep = () => {
    const pending = pendingStepRef.current;
    return pending && pending.fromKey === locationRef.current.key
      ? pending.step
      : getHomeStep(locationRef.current.search);
  };

  const enterReview = useCallback(({ replace = false } = {}) => {
    goTo(HOME_REVIEW_STEP, { replace });
  }, [goTo]);

  const exitReview = useCallback(({ hash = '' } = {}) => {
    goTo(null, { hash, replace: true });
  }, [goTo]);

  // W1 or W2 appears: Review is replaced; from the form, the step is pushed.
  const enterStatus = useCallback(() => {
    const step = getCurrentStep();
    if (step === HOME_STATUS_STEP) {
      return;
    }

    goTo(HOME_STATUS_STEP, { replace: step === HOME_REVIEW_STEP });
  }, [goTo]);

  const controller = useBridgeController({
    enterReview,
    enterStatus,
    exitReview,
    isReviewRequested,
    isStatusRequested
  });
  const isSendStoreReady = controller.isSendStoreReady !== false;
  const { hasReviewSnapshot, hasSendScreen, selectSendRecord, sendFlowRecords } = controller;

  // Leaving the status step with the browser Back button hides its record
  // until the next load (D22). Forward still shows it.
  useEffect(() => {
    const previousStep = previousStepRef.current;
    previousStepRef.current = homeStep;

    if (previousStep === HOME_STATUS_STEP && homeStep !== HOME_STATUS_STEP && navigationType === 'POP') {
      dismissSendRecord(getSendScreenState().selectedRecordId);
    }
  }, [homeStep, location.key, navigationType]);

  // Route decisions, in order, one navigation at a time. They wait until the
  // records store has read storage (`ready`), so a reload never flashes the
  // form before it reopens a screen.
  useEffect(() => {
    // Read the pending step from the ref: a decision earlier in this commit
    // (or a repeated effect run) may have navigated already.
    const pending = pendingStepRef.current;
    if ((pending && pending.fromKey === location.key) || !isSendStoreReady) {
      return;
    }

    const replaceWith = (step, hash = normalizedHash) => {
      goTo(step, { hash, replace: true });
    };

    // D22: once per load, the newest unresolved bridge send reopens its screen.
    if (!hasReopenedThisLoad()) {
      markReopenedThisLoad();
      const record = pickReopenRecord({
        chainId: EXPECTED_ETHEREUM_CHAIN_ID,
        isDismissed: isSendRecordDismissed,
        records: sendFlowRecords || []
      });

      if (record && !getSendScreenState().flow) {
        selectSendRecord?.(record.id);
        replaceWith(HOME_STATUS_STEP, '');
        return;
      }
    }

    if (hasInvalidHomeStep) {
      replaceWith(null);
      return;
    }

    if ((isReviewRequested && !hasReviewSnapshot) || (isStatusRequested && !hasSendScreen)) {
      replaceWith(null);
    }
  }, [
    goTo,
    hasInvalidHomeStep,
    hasReviewSnapshot,
    hasSendScreen,
    isNavigationPending,
    isReviewRequested,
    location.key,
    isSendStoreReady,
    isStatusRequested,
    normalizedHash,
    selectSendRecord,
    sendFlowRecords
  ]);

  // Late results: a bridge send that resolves while the user is on the form
  // opens its result once.
  const { getSendRecord, onSendTransition } = controller;

  useEffect(() => {
    if (typeof onSendTransition !== 'function') {
      return undefined;
    }

    return onSendTransition((event) => {
      const { flow } = getSendScreenState();
      const shouldOpen = shouldOpenLateResult({
        chainId: EXPECTED_ETHEREUM_CHAIN_ID,
        event,
        flow: isLiveSendFlow(flow) ? { ...flow, isLive: true } : null,
        isDismissed: isSendRecordDismissed,
        record: getSendRecord?.(event.recordId),
        step: getCurrentStep()
      });

      if (shouldOpen) {
        selectSendRecord?.(event.recordId);
        goTo(HOME_STATUS_STEP);
      }
    });
  }, [getSendRecord, goTo, onSendTransition, selectSendRecord]);

  useEffect(() => {
    if (!location.hash || hasInvalidHomeStep || (isReviewRequested && !hasReviewSnapshot)) {
      return;
    }

    if (location.hash === HOME_INFO_HASH && isReviewRequested) {
      return;
    }

    scrollToHomeSection(location.hash.replace('#', ''));
  }, [hasReviewSnapshot, hasInvalidHomeStep, isReviewRequested, location.hash]);

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

  // The hero and the page sections hide while Review or a send screen shows.
  const isReviewing = Boolean(controller.isReviewing || controller.isShowingStatus);

  return (
    <div className={styles.page}>
      <SiteHeader />

      <div className={styles.hero}>
        {!isReviewing ? (
          <div aria-hidden="true" className={styles.heroDecor} data-testid="hero-token-decor">
            {HERO_TOKEN_DECORATIONS.map((token) => (
              <div
                className={styles.heroToken}
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
