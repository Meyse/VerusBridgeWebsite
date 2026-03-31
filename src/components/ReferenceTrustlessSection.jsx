import React from 'react';

import { Link } from 'react-router-dom';

import styles from 'styles/ReferenceBridge.module.css';

const ArrowIcon = () => (
  <svg className={styles.linkArrow} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);

const LinkCard = ({ description, href, title, to }) => {
  const content = (
    <>
      <div className={styles.linkText}>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <ArrowIcon />
    </>
  );

  if (to) {
    return (
      <Link className={styles.linkCard} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <a className={styles.linkCard} href={href} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
};

const ReferenceTrustlessSection = ({ resources }) => (
  <section className={styles.trustSection} id="trustless-section">
    <div className={styles.trustInner}>
      <div className={styles.trustHeadline}>
        <h2 className={styles.trustHeadlineLine}>No company to trust.</h2>
        <h3 className={styles.trustHeadlineLine}>Just pure mathematics.</h3>
      </div>

      <div className={styles.trustFeatureGrid}>
        <div className={styles.trustFeatureCard}>
          <div className={styles.trustFeatureEmoji}>🔒</div>
          <p className={styles.trustFeatureCopy}>
            No single person or entity can steal, freeze, or manipulate your funds.
            Only mathematical consensus can move them.
          </p>
        </div>

        <div className={`${styles.trustFeatureCard} ${styles.trustFeatureCardAccent}`}>
          <div className={styles.trustFeatureEmoji}>⚡</div>
          <p className={`${styles.trustFeatureCopy} ${styles.trustFeatureCopyAccent}`}>
            Thousands of miners and stakers verify every transaction.
            No multisig wallets. No trusted parties.
          </p>
        </div>
      </div>

      <div className={styles.comparisonSection}>
        <div className={styles.comparisonHeader}>
          <h3 className={styles.comparisonHeadline}>Why most bridges fail.</h3>
          <p className={styles.comparisonDescription}>
            Numerous bridge hacks demonstrate critical flaws. Verus does things very differently.
          </p>
        </div>

        <div className={styles.comparisonGrid}>
          <div className={styles.comparisonCardBad}>
            <h4 className={`${styles.comparisonCardTitle} ${styles.comparisonCardTitleBad}`}>
              <span>⚠️</span>
              Traditional Bridges
            </h4>
            <div className={styles.comparisonRows}>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkBad}>×</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleBad}`}>Central custody control</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyBad}`}>
                    Single or few addresses hold all funds, creating central authority.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkBad}>×</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleBad}`}>Modifiable smart contracts</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyBad}`}>
                    Limited authorities can change contracts at will.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkBad}>×</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleBad}`}>Vulnerable to exploits</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyBad}`}>
                    Bugs and malicious code can drain all assets.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkBad}>×</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleBad}`}>Proven track record of failure</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyBad}`}>
                    Billions have already been lost in bridge hacks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.comparisonCardGood}>
            <h4 className={`${styles.comparisonCardTitle} ${styles.comparisonCardTitleGood}`}>
              <span>🛡️</span>
              Verus-Ethereum Bridge
            </h4>
            <div className={styles.comparisonRows}>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkGood}>✓</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleGood}`}>Distributed consensus custody</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyGood}`}>
                    Thousands of validators control fund movement.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkGood}>✓</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleGood}`}>Immutable protocols</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyGood}`}>
                    Mathematical consensus with no admin keys.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkGood}>✓</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleGood}`}>Cryptographic security</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyGood}`}>
                    Verifiable proofs instead of exploitable custody logic.
                  </p>
                </div>
              </div>
              <div className={styles.comparisonRow}>
                <span className={styles.comparisonMarkGood}>✓</span>
                <div>
                  <p className={`${styles.comparisonRowTitle} ${styles.comparisonRowTitleGood}`}>Dedicated recovery routes</p>
                  <p className={`${styles.comparisonRowCopy} ${styles.comparisonRowCopyGood}`}>
                    Claims, refunds, and NFT bridging stay accessible from the main interface.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.linksCard} id="resources">
        <div className={styles.linksHeader}>
          <h3 className={styles.linksTitle}>Helpful links</h3>
        </div>
        <div className={styles.linksGrid}>
          {resources.map((resource) => (
            <LinkCard
              description={resource.description}
              href={resource.href}
              key={resource.id}
              title={resource.title}
              to={resource.to}
            />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default ReferenceTrustlessSection;
