import React from 'react';

import styles from '../styles/ReferenceBridge.module.css';

const SiteFooter = () => (
  <footer className={styles.siteFooter}>
    <div className={styles.siteFooterInner}>
      <p className={styles.siteFooterText}>
        Made by the Verus community with <span aria-hidden="true">💙</span>
      </p>
    </div>
  </footer>
);

export default SiteFooter;
