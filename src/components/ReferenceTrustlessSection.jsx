import React from 'react';

import { Link } from 'react-router-dom';

import styles from 'styles/ReferenceBridge.module.css';
import { HOME_INFO_SECTION_ID } from 'utils/homeNavigation';

import { ReactComponent as TrustFlashIcon } from '../images/icons/trust-flash-icon.svg';
import { ReactComponent as TrustLockIcon } from '../images/icons/trust-lock-icon.svg';

const traditionalBridgeRisks = [
  {
    title: 'Central custody control',
    copy: 'Single or few addresses hold all funds, creating central authority.'
  },
  {
    title: 'Modifiable smart contracts',
    copy: 'Limited authorities can change contracts at will.'
  },
  {
    title: 'Vulnerable to exploits',
    copy: 'Bugs and malicious code can drain all assets.'
  },
  {
    title: 'Proven track record of failure',
    copy: 'Billions have already been lost in bridge hacks.'
  }
];

const bridgeAdvantages = [
  {
    title: 'Distributed consensus custody',
    copy: 'Thousands of validators control fund movement.'
  },
  {
    title: 'Immutable protocols',
    copy: 'Mathematical consensus with no admin keys.'
  },
  {
    title: 'Cryptographic security',
    copy: 'Verifiable proofs instead of exploitable custody logic.'
  },
  {
    title: 'Dedicated recovery routes',
    copy: 'Claims, refunds, and NFT bridging stay accessible from the main interface.'
  }
];

const FAQItem = ({ children, question }) => (
  <details className={styles.faqItem}>
    <summary className={styles.faqSummary}>
      <span className={styles.faqQuestion}>{question}</span>
      <span aria-hidden="true" className={styles.faqChevron} />
    </summary>
    <div className={styles.faqAnswer}>
      {children}
    </div>
  </details>
);

const ResourceLink = ({ href, title, to }) => {
  if (to) {
    return (
      <Link className={styles.faqResourceLink} to={to}>
        {title}
      </Link>
    );
  }

  return (
    <a className={styles.faqResourceLink} href={href} rel="noreferrer" target="_blank">
      {title}
    </a>
  );
};

const ReferenceTrustlessSection = ({ resources = [] }) => (
  <section className={styles.trustSection} id={HOME_INFO_SECTION_ID}>
    <div className={styles.trustInner}>
      <div className={styles.trustHeadline}>
        <h2 className={styles.trustHeadlineLine}>You don&apos;t need to trust anyone.</h2>
        <h3 className={styles.trustHeadlineLine}>This bridge is decentralized mathematics.</h3>
      </div>

      <div className={styles.trustFeatureGrid}>
        <div className={styles.trustFeatureCard}>
          <div className={styles.trustFeatureEmoji}>
            <TrustLockIcon
              aria-hidden="true"
              className={`${styles.trustFeatureIcon} ${styles.trustFeatureIconLock}`}
              focusable="false"
            />
          </div>
          <p className={styles.trustFeatureCopy}>
            No entity can steal, freeze, or manipulate your funds.
            Only mathematical consensus can move them.
          </p>
        </div>

        <div className={`${styles.trustFeatureCard} ${styles.trustFeatureCardAccent}`}>
          <div className={styles.trustFeatureEmoji}>
            <TrustFlashIcon
              aria-hidden="true"
              className={`${styles.trustFeatureIcon} ${styles.trustFeatureIconFlash}`}
              focusable="false"
            />
          </div>
          <p className={`${styles.trustFeatureCopy} ${styles.trustFeatureCopyAccent}`}>
            Thousands of miners and stakers verify every transaction.
            No multisig wallets. No trusted parties.
          </p>
        </div>
      </div>

      <div className={styles.faqSection} id="resources">
        <div className={styles.faqHeader}>
          <h3 className={styles.faqHeadline}>FAQ</h3>
        </div>

        <div className={styles.faqList}>
          <FAQItem question="Why do most bridges fail?">
            <p className={styles.faqAnswerLead}>
              Numerous bridge hacks demonstrate the same structural weaknesses over and over again.
            </p>
            <ul className={styles.faqBulletList}>
              {traditionalBridgeRisks.map((risk) => (
                <li className={styles.faqBulletItem} key={risk.title}>
                  <p className={styles.faqBulletTitle}>{risk.title}</p>
                  <p className={styles.faqBulletCopy}>{risk.copy}</p>
                </li>
              ))}
            </ul>
          </FAQItem>

          <FAQItem question="What makes the Verus-Ethereum Bridge different?">
            <p className={styles.faqAnswerLead}>
              Verus removes trusted control points and replaces them with consensus-enforced rules.
            </p>
            <ul className={styles.faqBulletList}>
              {bridgeAdvantages.map((advantage) => (
                <li className={styles.faqBulletItem} key={advantage.title}>
                  <p className={styles.faqBulletTitle}>{advantage.title}</p>
                  <p className={styles.faqBulletCopy}>{advantage.copy}</p>
                </li>
              ))}
            </ul>
          </FAQItem>

          <FAQItem question="Who can move my funds?">
            <p className={styles.faqAnswerLead}>
              No entity can steal, freeze, or manipulate your funds. Only mathematical consensus can move them.
            </p>
          </FAQItem>

          <FAQItem question="Who verifies each transaction?">
            <p className={styles.faqAnswerLead}>
              Thousands of miners and stakers verify every transaction. No multisig wallets. No trusted parties.
            </p>
          </FAQItem>

          <FAQItem question="Where do I go for claims, NFT bridging, and contract inspection?">
            <p className={styles.faqAnswerLead}>
              Claims, refunds, and NFT bridging stay accessible from the main interface, and the live bridge
              contracts can be inspected directly whenever you want to verify them yourself.
            </p>
            {resources.length > 0 ? (
              <ul className={styles.faqResourceList}>
                {resources.map((resource) => (
                  <li className={styles.faqResourceItem} key={resource.id}>
                    <ResourceLink href={resource.href} title={resource.title} to={resource.to} />
                    <span className={styles.faqResourceDescription}>{resource.description}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </FAQItem>
        </div>
      </div>
    </div>
  </section>
);

export default ReferenceTrustlessSection;
