import React, { useCallback } from 'react';

import SiteHeader from 'components/SiteHeader';
import { TESTNET } from 'constants/contractAddress';
import useClaimController from 'hooks/useClaimController';
import { getCurrencyIcon } from 'utils/bridgeUi';

import styles from '../styles/ReferenceBridge.module.css';

const ZERO_WIDTH_SPACE = '\u200b';

const statusToneClassNames = {
  error: styles.claimStatusError,
  info: styles.claimStatusInfo,
  success: styles.claimStatusSuccess,
  warning: styles.claimStatusWarning
};

const buildPanelStatus = ({ hasAddress, idleMessage, isPending, pendingMessage, status }) => {
  if (isPending) {
    return {
      severity: 'info',
      message: pendingMessage
    };
  }

  if (status) {
    return status;
  }

  if (!hasAddress) {
    return {
      severity: 'info',
      message: idleMessage
    };
  }

  return null;
};

const hasClaimableEarnings = (amount) => Boolean(amount && amount !== '0.00000000');

const PasteIcon = () => (
  <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path d="M9 4.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path
      d="M8 4.5H6.5A1.5 1.5 0 0 0 5 6v12.5A1.5 1.5 0 0 0 6.5 20h11A1.5 1.5 0 0 0 19 18.5V6a1.5 1.5 0 0 0-1.5-1.5H16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <rect
      height="3.5"
      rx="1"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
      width="8"
      x="8"
      y="2.75"
    />
    <path d="M9 11h6M9 15h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

const ClaimActionButton = ({
  children,
  className = '',
  disabled = false,
  fullWidth = false,
  loading = false,
  onClick,
  tone = 'primary'
}) => (
  <button
    className={[
      styles.claimActionButton,
      tone === 'primary' ? styles.claimActionButtonPrimary : styles.claimActionButtonSoft,
      fullWidth ? styles.claimActionButtonFullWidth : '',
      disabled ? styles.claimActionButtonDisabled : '',
      className
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {loading ? 'Working…' : children}
  </button>
);

const StatusMessage = ({ status }) => {
  if (!status?.message) {
    return null;
  }

  return (
    <p className={`${styles.claimStatus} ${statusToneClassNames[status.severity] || styles.claimStatusInfo}`}>
      {status.message}
    </p>
  );
};

const FAQItem = ({ children, question }) => (
  <details className={styles.faqItem}>
    <summary className={styles.faqSummary}>
      <span className={styles.faqQuestion}>{question}</span>
      <span aria-hidden="true" className={styles.faqChevron} />
    </summary>
    <div className={styles.faqAnswer}>{children}</div>
  </details>
);

const REFUND_FAQ_ITEM = {
  question: 'How can I claim funds that are stuck?',
  content: (
    <>
      <p className={styles.faqAnswerLead}>
        Paste the Verus refund address tied to that bridge transfer.
      </p>
      <div className={styles.faqAnswerCopy}>
        <p className={styles.faqBulletCopy}>
          The page checks supported tokens for refundable balances stored for that address and shows any assets
          available to claim. Refund claims are exported back to that Verus address.
        </p>
      </div>
    </>
  )
};

const CLAIM_FAQ_ITEMS = [
  {
    question: 'How can I earn money with the Verus-Ethereum Bridge?',
    content: (
      <>
        <p className={styles.faqAnswerLead}>
          You can earn fees from bridge crossings when you run Bridgekeeper while you are staking or mining.
        </p>
        <div className={styles.faqAnswerCopy}>
          <p className={styles.faqBulletCopy}>
            You have to run a full node to be able to earn from the bridge. If you are pool mining, contact your
            pool operator to see if they run Bridgekeeper and whether they pay out earnings from it.
          </p>
          <p className={styles.faqBulletCopy}>
            Here are video tutorials on how to run Bridgekeeper:{' '}
            <a
              className={styles.faqInlineLink}
              href="https://youtu.be/kyEqBX_erJo?si=6v4AmdzGCrtxfR5z"
              rel="noreferrer"
              target="_blank"
            >
              Verus Desktop
            </a>
            {' '}and{' '}
            <a
              className={styles.faqInlineLink}
              href="https://youtu.be/Ml3bFNcpVjw?si=5D3gFN93tvDVTf1R"
              rel="noreferrer"
              target="_blank"
            >
              CLI
            </a>
            .
          </p>
        </div>
      </>
    )
  },
  {
    question: 'How can I claim bridge earnings?',
    content: (
      <>
        <p className={styles.faqAnswerLead}>
          Paste the Verus i-address or R-address you want to inspect.
        </p>
        <div className={styles.faqAnswerCopy}>
          <p className={styles.faqBulletCopy}>
            When you are using an R-address, you must connect an Ethereum wallet whose signed public key derives
            that same payout address. In practice, that usually means importing that private key into MetaMask. After
            you verify it with <strong>Use connected wallet</strong>, the earnings are paid to the connected Ethereum
            wallet.
          </p>
          <p className={styles.faqBulletCopy}>
            When you are using a VerusID (i-address), you can submit the claim from this website with a connected
            Ethereum wallet. The earnings are exported back to that i-address on Verus rather than paid to the
            connected Ethereum wallet.
          </p>
          <p className={styles.faqBulletCopy}>
            The current site only enables i-address claims once at least 0.006 ETH is available. R-address claims do
            not use that same minimum, but they do require a matching connected wallet.
          </p>
        </div>
      </>
    )
  },
  REFUND_FAQ_ITEM
];

const ACTIVE_CLAIM_FAQ_ITEMS = TESTNET ? [REFUND_FAQ_ITEM] : CLAIM_FAQ_ITEMS;

const Claim = () => {
  const controller = useClaimController();
  const trimmedAddress = controller.address.trim();
  const setLookupAddress = controller.setAddress;
  const hasValidLookupAddress = Boolean(trimmedAddress) && !controller.addressError;
  const addressInputClassName = [
    styles.addressInput,
    styles.claimAddressInput,
    styles.claimAddressInputIconOnly,
    controller.addressError ? styles.addressInputInvalid : '',
    hasValidLookupAddress ? styles.addressInputValid : ''
  ].filter(Boolean).join(' ');
  const earningsPanelStatus = TESTNET ? null : buildPanelStatus({
    hasAddress: Boolean(trimmedAddress),
    idleMessage: 'Enter a Verus address to inspect bridgekeeper earnings.',
    isPending: controller.isEarningsLookupPending,
    pendingMessage: 'Checking bridgekeeper earnings…',
    status: controller.earningsStatus
  });
  const refundPanelStatus = buildPanelStatus({
    hasAddress: Boolean(trimmedAddress),
    idleMessage: 'Enter a Verus address to inspect refunded assets.',
    isPending: controller.isRefundLookupPending,
    pendingMessage: 'Checking refunded assets…',
    status: controller.refundStatus
  });
  const showEmptyLookupState = controller.isEmptyLookup && hasValidLookupAddress;
  const earningsDisplay = controller.isEarningsLookupPending
    ? 'Checking…'
    : controller.earningsAmount || ZERO_WIDTH_SPACE;
  const showEarningsTicker = !controller.isEarningsLookupPending && controller.earningsAmount !== null;
  const showEarningsAction = hasClaimableEarnings(controller.earningsAmount);
  const hasEarningsPanelContent = controller.isEarningsLookupPending
    || controller.earningsAmount !== null
    || Boolean(earningsPanelStatus);
  const hasRefundsPanelContent = controller.isRefundLookupPending
    || controller.refundEntries.length > 0
    || Boolean(refundPanelStatus);
  const showEarningsPanel = !TESTNET
    && hasValidLookupAddress
    && !showEmptyLookupState
    && hasEarningsPanelContent;
  const showRefundsPanel = hasValidLookupAddress
    && !showEmptyLookupState
    && hasRefundsPanelContent;
  const showWalletShortcut = !controller.isWalletVerificationRequired || !controller.isWalletLinkedAddress;
  const showEarningsStatus = Boolean(
    earningsPanelStatus
    && (controller.isEarningsLookupPending || !showEarningsAction || earningsPanelStatus.severity !== 'info')
  );
  const handlePasteAddress = useCallback(async () => {
    try {
      const clipboardText = await navigator?.clipboard?.readText?.();
      if (clipboardText) {
        setLookupAddress(clipboardText.trim());
      }
    } catch (error) {
      // Ignore clipboard failures and leave the existing input untouched.
    }
  }, [setLookupAddress]);

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.secondaryMain}>
        <div className={styles.secondaryContent}>
          <div className={styles.claimLayout}>
            <section className={styles.claimWorkbench}>
              <div className={styles.claimInputBlock}>
                <div className={`${styles.claimInputRow} ${!showWalletShortcut ? styles.claimInputRowCentered : ''}`}>
                  <div className={`${styles.addressWrapper} ${styles.claimAddressField}`}>
                    <input
                      className={addressInputClassName}
                      onChange={(event) => controller.setAddress(event.target.value)}
                      placeholder="Enter your Verus i-address or R-address"
                      type="text"
                      value={controller.address}
                    />

                    <div className={styles.addressActions}>
                      <button
                        aria-label="Paste address"
                        className={styles.claimPasteButton}
                        onClick={handlePasteAddress}
                        type="button"
                      >
                        <PasteIcon />
                      </button>
                    </div>
                  </div>
                  {showWalletShortcut ? (
                    <button
                      className={styles.claimInputShortcut}
                      disabled={controller.isWalletAddressPending}
                      onClick={controller.handleWalletAddressAction}
                      type="button"
                    >
                      {controller.isWalletAddressPending ? 'Working…' : controller.walletActionLabel}
                    </button>
                  ) : null}
                </div>
                {controller.addressError ? <p className={styles.claimInlineHelp}>{controller.addressError}</p> : null}
                <StatusMessage status={controller.walletAddressStatus} />
              </div>

              <div className={styles.claimResultsArea}>
                <div className={styles.claimSectionStack}>
                  {showEmptyLookupState ? (
                    <section className={styles.claimEmptyState}>
                      <h2 className={styles.claimEmptyStateTitle}>Nothing ready for this address</h2>
                      <p className={styles.claimEmptyStateCopy}>
                        {TESTNET
                          ? 'No refunded assets are available to claim right now.'
                          : 'No bridgekeeper earnings or refunded assets are available to claim right now.'}
                      </p>
                    </section>
                  ) : null}

                  {showEarningsPanel ? (
                    <section className={styles.claimPanel}>
                      <div className={`${styles.claimPanelInner} ${styles.claimPanelInnerCentered}`}>
                        <div className={styles.claimColumnHeader}>
                          <span className={styles.claimSectionLabel}>Bridgekeeper earnings</span>
                        </div>

                        <div className={styles.claimAmountPanel}>
                          <span className={styles.claimAmountValue}>{earningsDisplay}</span>
                          {showEarningsTicker ? (
                            <span className={styles.claimAmountTicker}>ETH</span>
                          ) : null}
                        </div>

                        {showEarningsStatus ? <StatusMessage status={earningsPanelStatus} /> : null}

                        {showEarningsAction && controller.earningsClaimHelp ? (
                          <p className={styles.claimInlineHelp}>{controller.earningsClaimHelp}</p>
                        ) : null}

                        {showEarningsAction ? (
                          <ClaimActionButton
                            className={styles.claimActionButtonCompact}
                            disabled={!controller.canClaimEarnings}
                            loading={controller.actionTarget === 'earnings'}
                            onClick={controller.handleClaimEarnings}
                          >
                            {controller.earningsActionLabel}
                          </ClaimActionButton>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {showRefundsPanel ? (
                    <section className={`${styles.claimPanel} ${styles.claimPanelSecondary}`}>
                      <div className={styles.claimPanelInner}>
                        <div className={styles.claimColumnHeader}>
                          <span className={styles.claimSectionLabel}>Refunded assets</span>
                        </div>

                        <StatusMessage status={refundPanelStatus} />

                        <div className={styles.claimRefundList}>
                          {controller.refundEntries.map((entry) => (
                            <div className={styles.claimRefundRow} key={entry.value}>
                              <div className={styles.claimRefundMain}>
                                <img
                                  alt=""
                                  className={styles.claimRefundIcon}
                                  src={getCurrencyIcon(entry)}
                                />
                                <div className={styles.claimRefundText}>
                                  <span className={styles.claimRefundTitle}>{entry.name}</span>
                                  <span className={styles.claimRefundMeta}>{entry.amount} available to recover</span>
                                </div>
                              </div>

                              <ClaimActionButton
                                disabled={!controller.canSubmitWalletTransactions || controller.isActionPending}
                                loading={controller.actionTarget === `refund:${entry.value}`}
                                onClick={() => controller.handleClaimRefund(entry.value)}
                                tone="soft"
                              >
                                Claim {entry.name} to this address
                              </ClaimActionButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>

              <section className={styles.claimFaqSection}>
                <div className={`${styles.faqList} ${styles.claimFaqList}`}>
                  {ACTIVE_CLAIM_FAQ_ITEMS.map((item) => (
                    <FAQItem key={item.question} question={item.question}>
                      {item.content}
                    </FAQItem>
                  ))}
                </div>
              </section>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Claim;
