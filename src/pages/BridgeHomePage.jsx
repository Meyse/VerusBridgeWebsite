import React, { useEffect, useState } from 'react';

import { useLocation } from 'react-router-dom';

import BridgeCard from 'components/BridgeCard';
import ReferenceInfoBar from 'components/ReferenceInfoBar';
import ReferenceTrustlessSection from 'components/ReferenceTrustlessSection';
import SiteHeader from 'components/SiteHeader';
import { getExplorerResources } from 'config/explorerLinks';
import useBridgeController from 'hooks/useBridgeController';

import styles from '../styles/ReferenceBridge.module.css';

const internalResources = [
  {
    id: 'claim',
    title: 'Claim / Refunds',
    description: 'Recover claimable fees or refund balances with the live bridge recovery route.',
    to: '/claim'
  },
  {
    id: 'nft',
    title: 'NFT Bridge',
    description: 'Use the NFT route for ERC-721 and ERC-1155 bridging.',
    to: '/nft'
  }
];

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

const scrollToSection = (sectionId) => {
  const targetNode = document.getElementById(sectionId);
  if (!targetNode) {
    return;
  }

  window.requestAnimationFrame(() => {
    targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

const BridgeHomePage = () => {
  const controller = useBridgeController();
  const location = useLocation();
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(getScrollIndicatorOpacity);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    scrollToSection(location.hash.replace('#', ''));
  }, [location.hash]);

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

  const resources = [...internalResources, ...getExplorerResources()];

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
            <div className={styles.titleWrap}>
              <h1 className={styles.title}>Bridge assets securely</h1>
            </div>

            <div className={styles.formCenter}>
              <BridgeCard controller={controller} />
              <p className={styles.supportingText}>
                Bridge or convert completely trustless into Verus, or convert back into Ethereum. No counterparty risk.
              </p>
            </div>
          </div>
        </main>

        <div className={styles.scrollIndicatorWrap}>
          <button
            className={styles.scrollIndicator}
            onClick={() => scrollToSection('trustless-section')}
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
      </div>

      <ReferenceTrustlessSection resources={resources} />
    </div>
  );
};

export default BridgeHomePage;
