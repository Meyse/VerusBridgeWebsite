import React from 'react';

import { Link } from 'react-router-dom';

import NFTForm from 'components/NFTForm/NFTForm';
import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';

import styles from '../styles/ReferenceBridge.module.css';

const NFT = () => (
  <div className={styles.page}>
    <SiteHeader />

    <main className={styles.secondaryMain}>
      <div className={styles.secondaryContent}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>NFT Bridge</h1>
          <p className={styles.supportingText}>
            Move ERC-721 and ERC-1155 assets through the same bridge stack on a dedicated route.
          </p>
        </div>

        <div className={`${styles.secondaryCard} ${styles.secondaryCardWide}`}>
          <div className={styles.legacyPanel}>
            <NFTForm />
          </div>

          <div className={styles.secondaryActions}>
            <Link className={styles.secondaryLink} to="/">
              Back to bridge
            </Link>
            <Link className={styles.secondaryLink} to="/claim">
              Claim / Refunds
            </Link>
          </div>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
);

export default NFT;
