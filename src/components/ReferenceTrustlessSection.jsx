import React from 'react';

import { getExplorerResources } from 'config/explorerLinks';
import { ETHEREUM_BLOCKCHAIN_NAME } from 'constants/contractAddress';
import styles from 'styles/ReferenceBridge.module.css';
import { HOME_INFO_SECTION_ID } from 'utils/homeNavigation';

import TrustFlashIcon from '../images/icons/trust-flash-icon.svg?react';
import TrustLockIcon from '../images/icons/trust-lock-icon.svg?react';

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

const ReferenceTrustlessSection = () => {
  const bridgeContract = getExplorerResources().find((resource) => resource.id === 'contract');

  return (
    <section className={styles.trustSection} id={HOME_INFO_SECTION_ID}>
    <div className={styles.trustInner}>
      <div className={styles.trustHeadline}>
        <h2 className={styles.trustHeadlineLine}>Security without a custodial multisig</h2>
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
            No company, operator, or multisig wallet controls the bridge reserves.
            Cross-chain transfers follow public protocol rules instead of custodial approval.
          </p>
        </div>

        <div className={styles.trustFeatureCard}>
          <div className={styles.trustFeatureEmoji}>
            <TrustFlashIcon
              aria-hidden="true"
              className={`${styles.trustFeatureIcon} ${styles.trustFeatureIconFlash}`}
              focusable="false"
            />
          </div>
          <p className={styles.trustFeatureCopy}>
            Security is layered across Verus consensus, witnessed notarizations, and the Ethereum contracts.
            Each layer must validate the same transaction correctly.
          </p>
        </div>
      </div>

      <div className={styles.faqSection} id="resources">
        <div className={styles.faqHeader}>
          <h3 className={styles.faqHeadline}>FAQ</h3>
        </div>

        <div className={styles.faqList}>
          <FAQItem question="How does the bridge avoid custodial key risk?">
            <p className={styles.faqAnswerLead}>
              The bridge does not rely on a company, single key holder, or small multisig group to
              approve withdrawals or control the bridge reserves.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                Cross-chain transfers must follow public protocol rules. Verus miners and stakers
                confirm Verus chain state, while witnessed notarizations carry that state across the bridge.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="How are cross-chain transfers verified?">
            <p className={styles.faqAnswerLead}>
              Verus miners and stakers confirm Verus chain state through consensus. Witnessed
              notarizations then carry cryptographic evidence of that state to the Ethereum contracts.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                The security of the complete bridge depends on every layer validating and interpreting
                that evidence correctly.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="What happened in the 2026 bridge exploits?">
            <p className={styles.faqAnswerLead}>
              In May and July 2026, attackers exploited flaws in cross-chain validation. The Ethereum
              contracts accepted invalid claims and released assets that were not backed by matching
              exports from Verus.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                The attacks did not compromise a custodial multisig or take control of the Verus mining
                and staking network. They exposed implementation failures at the boundary between Verus
                and Ethereum.
              </p>
              <p className={styles.faqBulletCopy}>
                Following the exploits, the Verus protocol and Ethereum contracts were upgraded with
                hardened validation. The affected paths underwent code review, regression testing, and
                fuzzing before the bridge reopened.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="How long does it take for my funds to arrive on Verus?">
            <p className={styles.faqAnswerLead}>
              Your funds arrive after two witnessed bridge notarizations have been confirmed.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                These notarizations are cryptographic snapshots of both chains, created and
                verified by the decentralized network of miners and stakers.
              </p>
              <p className={styles.faqBulletCopy}>
                How quickly that happens depends on bridge activity. Notarizations are only
                produced when there&apos;s traffic to process. {ETHEREUM_BLOCKCHAIN_NAME} confirmation times and gas
                conditions also play a role. The process isn&apos;t instant because the required proof and
                confirmation steps must complete before the transfer can be accepted.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="Where can I inspect the Verus-Ethereum Bridge contract?">
            <p className={styles.faqAnswerLead}>
              {bridgeContract ? (
                <>
                  You can find the contract configured for this build here:{' '}
                  <a
                    className={styles.faqInlineLink}
                    href={bridgeContract.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {bridgeContract.href}
                  </a>
                </>
              ) : 'The bridge contract is not configured for this build.'}
            </p>
          </FAQItem>

          <FAQItem question="Are the website and the bridge contract open source?">
            <p className={styles.faqAnswerLead}>
              Yes. You can find the website here:{' '}
              <a
                className={styles.faqInlineLink}
                href="https://github.com/VerusCoin/VerusBridgeWebsite"
                rel="noreferrer"
                target="_blank"
              >
                https://github.com/VerusCoin/VerusBridgeWebsite
              </a>
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                And the Ethereum contracts here:{' '}
                <a
                  className={styles.faqInlineLink}
                  href="https://github.com/VerusCoin/Verus-Ethereum-Contracts"
                  rel="noreferrer"
                  target="_blank"
                >
                  https://github.com/VerusCoin/Verus-Ethereum-Contracts
                </a>
              </p>
            </div>
          </FAQItem>
        </div>
      </div>
    </div>
    </section>
  );
};

export default ReferenceTrustlessSection;
