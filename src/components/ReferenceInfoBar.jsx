import React, { useEffect, useRef, useState } from 'react';

import {
  BLOCKCHAIN_NAME,
  ETHEREUM_BLOCKCHAIN_NAME,
  TESTNET,
  VERUS_BLOCKCHAIN_DISPLAY_NAME
} from 'constants/contractAddress';
import styles from 'styles/ReferenceBridge.module.css';
import { getCurrencyIcon } from 'utils/bridgeUi';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});
const blockHeightFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const formatFeeValue = (amount, ethUsdPrice) => {
  if (!Number.isFinite(amount)) {
    return { amount: '--', fiat: null };
  }

  return {
    amount: `${amount.toFixed(amount < 0.01 ? 4 : 3)} ETH`,
    fiat: !TESTNET && Number.isFinite(ethUsdPrice)
      ? usdFormatter.format(amount * ethUsdPrice)
      : null
  };
};

const renderFeeValue = (amount, ethUsdPrice) => {
  const feeValue = formatFeeValue(amount, ethUsdPrice);

  return (
    <>
      {feeValue.fiat ? <span className={styles.infoChipFiat}>{feeValue.fiat}</span> : null}
      <span className={styles.infoChipAmount}>{feeValue.amount}</span>
    </>
  );
};

const formatLagDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${totalMinutes}m`;
};

const formatLagAgo = (seconds) => {
  if (Number.isFinite(seconds) && seconds <= 0) {
    return 'just now';
  }

  const lagDuration = formatLagDuration(seconds);
  return lagDuration ? `~${lagDuration} ago` : '--';
};

const formatBlockHeight = (value) => {
  if (!Number.isFinite(value) || value <= 1) {
    return '--';
  }

  return blockHeightFormatter.format(value);
};

const getNotarizationTooltipDetails = ({ notarizationHeight, verusTipHeight }) => {
  if (!Number.isFinite(notarizationHeight) || notarizationHeight <= 1) {
    return null;
  }

  const stats = [
    {
      label: 'Notarization block',
      value: formatBlockHeight(notarizationHeight)
    }
  ];

  if (Number.isFinite(verusTipHeight) && verusTipHeight > 1) {
    stats.push({
      label: 'Verus tip',
      value: formatBlockHeight(verusTipHeight)
    });
  }

  return {
    stats,
    note:
      'You can see your funds on the Verus side after two confirmed bridge notarizations. If it includes a conversion it might take a few minutes longer.'
  };
};

const InfoIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 7v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <circle cx="8" cy="4.75" fill="currentColor" r="0.75" />
  </svg>
);

const DisclosureChevron = ({ isOpen }) => (
  <svg
    aria-hidden="true"
    className={isOpen ? `${styles.mobileInfoChevron} ${styles.mobileInfoChevronOpen}` : styles.mobileInfoChevron}
    fill="none"
    height="16"
    viewBox="0 0 24 24"
    width="16"
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const ReferenceInfoBar = ({
  baseBridgeFee,
  bounceBackFee,
  ethUsdPrice,
  notarizationHeight,
  notarizationLagSeconds,
  verusTipHeight,
  ethToVerusCost,
  verusToEthCost
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const infoBarRef = useRef(null);
  const popoverIdRef = useRef(`notarization-popover-${Math.random().toString(36).slice(2, 10)}`);
  const mobileDetailsIdRef = useRef(`costs-status-details-${Math.random().toString(36).slice(2, 10)}`);
  const notarizationTooltipDetails = getNotarizationTooltipDetails({
    notarizationHeight,
    verusTipHeight
  });
  const ethIcon = getCurrencyIcon('ETH');
  const verusIcon = getCurrencyIcon(BLOCKCHAIN_NAME);
  const directFee = baseBridgeFee ?? ethToVerusCost;
  const bouncebackFee = bounceBackFee ?? verusToEthCost;
  const directFeeValue = formatFeeValue(directFee, ethUsdPrice);
  const mobileFeeSummary = directFeeValue.fiat || directFeeValue.amount;

  useEffect(() => {
    if (!isDetailsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (infoBarRef.current && !infoBarRef.current.contains(event.target)) {
        setIsDetailsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDetailsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDetailsOpen]);

  const activityChip = (
    <div className={`${styles.infoChip} ${styles.activityChip}`}>
      <span className={styles.activityLabel}>Last confirmed bridge notarization:</span>
      <div className={styles.activityValueRow}>
        <span className={styles.activityValue}>{formatLagAgo(notarizationLagSeconds)}</span>
        {notarizationTooltipDetails ? (
          <button
            aria-controls={isDetailsOpen ? popoverIdRef.current : undefined}
            aria-expanded={isDetailsOpen}
            aria-haspopup="dialog"
            aria-label="Show bridge notarization details"
            className={styles.activityInfoButton}
            onClick={() => setIsDetailsOpen((currentValue) => !currentValue)}
            type="button"
          >
            <InfoIcon />
          </button>
        ) : null}
      </div>
      {isDetailsOpen && notarizationTooltipDetails ? (
        <div
          aria-label="Bridge notarization details"
          className={styles.activityPopover}
          id={popoverIdRef.current}
          role="dialog"
        >
          <div className={styles.activityPopoverStats}>
            {notarizationTooltipDetails.stats.map(({ label, value }) => (
              <div className={styles.activityPopoverRow} key={label}>
                <span className={styles.activityPopoverLabel}>{label}</span>
                <span className={styles.activityPopoverValue}>{value}</span>
              </div>
            ))}
          </div>
          <p className={styles.activityPopoverNote}>{notarizationTooltipDetails.note}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={styles.infoBar}>
      <div className={styles.infoBarInner} ref={infoBarRef}>
        <div className={styles.infoGroup}>
          <div className={styles.infoChip}>
            <div className={styles.infoChipIconGroup}>
              <img
                alt={ETHEREUM_BLOCKCHAIN_NAME}
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt={VERUS_BLOCKCHAIN_DISPLAY_NAME}
                className={styles.currencyIcon}
                src={verusIcon}
              />
            </div>
            <span className={styles.infoChipValue}>
              {renderFeeValue(directFee, ethUsdPrice)}
            </span>
          </div>

          <div className={styles.infoChip}>
            <div className={styles.infoChipIconGroup}>
              <img
                alt={ETHEREUM_BLOCKCHAIN_NAME}
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt={VERUS_BLOCKCHAIN_DISPLAY_NAME}
                className={styles.currencyIcon}
                src={verusIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt={ETHEREUM_BLOCKCHAIN_NAME}
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
            </div>
            <span className={styles.infoChipValue}>
              {renderFeeValue(bouncebackFee, ethUsdPrice)}
            </span>
          </div>
        </div>

        {activityChip}

        <div className={styles.mobileInfoPanel}>
          <button
            aria-controls={mobileDetailsIdRef.current}
            aria-expanded={isDetailsOpen}
            aria-label="Costs and status"
            className={styles.mobileInfoSummary}
            onClick={() => setIsDetailsOpen((currentValue) => !currentValue)}
            type="button"
          >
            <span className={styles.mobileInfoHeading}>Costs and status</span>
            <span className={styles.mobileInfoSummaryValue}>
              Fee {mobileFeeSummary} · Last {formatLagAgo(notarizationLagSeconds)}
            </span>
            <DisclosureChevron isOpen={isDetailsOpen} />
          </button>

          {isDetailsOpen ? (
            <div
              aria-label="Costs and status details"
              className={styles.mobileInfoDetails}
              id={mobileDetailsIdRef.current}
              role="region"
            >
              <div className={styles.mobileInfoDetailRow}>
                <span>Ethereum → Verus</span>
                <span className={styles.mobileInfoDetailValue}>{renderFeeValue(directFee, ethUsdPrice)}</span>
              </div>
              <div className={styles.mobileInfoDetailRow}>
                <span>Ethereum → Verus → Ethereum</span>
                <span className={styles.mobileInfoDetailValue}>{renderFeeValue(bouncebackFee, ethUsdPrice)}</span>
              </div>

              {notarizationTooltipDetails ? (
                <>
                  <div className={styles.mobileInfoDivider} />
                  {notarizationTooltipDetails.stats.map(({ label, value }) => (
                    <div className={styles.mobileInfoDetailRow} key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                  <p className={styles.mobileInfoNote}>{notarizationTooltipDetails.note}</p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ReferenceInfoBar;
