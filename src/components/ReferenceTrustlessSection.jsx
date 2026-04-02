import React from 'react';

import styles from 'styles/ReferenceBridge.module.css';
import { HOME_INFO_SECTION_ID } from 'utils/homeNavigation';

import { ReactComponent as TrustFlashIcon } from '../images/icons/trust-flash-icon.svg';
import { ReactComponent as TrustLockIcon } from '../images/icons/trust-lock-icon.svg';

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

const ReferenceTrustlessSection = () => (
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
              Most bridges have two weak points. First, they rely on a small group of key holders
              (a multisig wallet) to custody funds. If those keys are compromised through hacking,
              social engineering, or insider collusion, the funds can be drained.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                Second, they depend on smart contracts that can contain vulnerabilities or, worse,
                can be upgraded or modified by a small team. That means even a contract that looks
                safe today can be changed tomorrow.
              </p>
              <p className={styles.faqBulletCopy}>
                Billions have been lost to both attack vectors. The fundamental problem is the same
                in each case: you&apos;re trusting a small group of people with everyone&apos;s money.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="What makes the Verus-Ethereum Bridge different?">
            <p className={styles.faqAnswerLead}>
              No single entity, multisig, or key holder has custody of your funds at any point.
              Instead, the entire decentralized network of Verus miners and stakers verifies every
              cross-chain transaction through consensus rules.
            </p>
            <div className={styles.faqAnswerCopy}>
              <p className={styles.faqBulletCopy}>
                To attack this bridge, you&apos;d need to simultaneously compromise the majority of
                the mining and staking network, have colluding notary witnesses, and run a fake
                shadow chain.
              </p>
              <p className={styles.faqBulletCopy}>
                These are requirements comparable to attacking the blockchain itself.
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
                produced when there&apos;s traffic to process. Ethereum confirmation times and gas
                conditions also play a role. The process isn&apos;t instant, but every step exists to
                make sure your funds are cryptographically proven before they arrive.
              </p>
            </div>
          </FAQItem>

          <FAQItem question="Where can I inspect the Verus-Ethereum Bridge contract?">
            <p className={styles.faqAnswerLead}>
              You can find the contract here:{' '}
              <a
                className={styles.faqInlineLink}
                href="https://etherscan.io/address/0x71518580f36FeCEFfE0721F06bA4703218cD7F63"
                rel="noreferrer"
                target="_blank"
              >
                https://etherscan.io/address/0x71518580f36FeCEFfE0721F06bA4703218cD7F63
              </a>
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

export default ReferenceTrustlessSection;
