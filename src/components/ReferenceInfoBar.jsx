import React, { useEffect, useRef, useState } from 'react';

import { BLOCKCHAIN_NAME } from 'constants/contractAddress';
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

const renderFeeValue = (amount, ethUsdPrice) => {
  if (!Number.isFinite(amount)) {
    return '--';
  }

  const formattedAmount = `${amount.toFixed(amount < 0.01 ? 4 : 3)} ETH`;
  const formattedFiat = Number.isFinite(ethUsdPrice) ? usdFormatter.format(amount * ethUsdPrice) : null;

  return (
    <>
      {formattedFiat ? <span className={styles.infoChipFiat}>{formattedFiat}</span> : null}
      <span className={styles.infoChipAmount}>{formattedAmount}</span>
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
  return lagDuration ? `${lagDuration} ago` : '--';
};

const formatBlockHeight = (value) => {
  if (!Number.isFinite(value) || value <= 1) {
    return '--';
  }

  return blockHeightFormatter.format(value);
};

const getNotarizationTooltipText = ({ notarizationHeight, notarizationLagBlocks, verusTipHeight }) => {
  if (!Number.isFinite(notarizationHeight) || notarizationHeight <= 1) {
    return null;
  }

  const lines = [`Notarization block: ${formatBlockHeight(notarizationHeight)}`];

  if (Number.isFinite(verusTipHeight) && verusTipHeight > 1) {
    lines.push(`Verus tip: ${formatBlockHeight(verusTipHeight)}`);
  }

  if (Number.isFinite(notarizationLagBlocks)) {
    lines.push(
      `${blockHeightFormatter.format(Math.max(0, notarizationLagBlocks))} ${notarizationLagBlocks === 1 ? 'block' : 'blocks'} behind`
    );
  }

  return lines.join('\n');
};

const InfoIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 7v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <circle cx="8" cy="4.75" fill="currentColor" r="0.75" />
  </svg>
);

const ReferenceInfoBar = ({
  baseBridgeFee,
  bounceBackFee,
  ethUsdPrice,
  notarizationHeight,
  notarizationLagBlocks,
  notarizationLagSeconds,
  verusTipHeight,
  ethToVerusCost,
  verusToEthCost
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const activityChipRef = useRef(null);
  const popoverIdRef = useRef(`notarization-popover-${Math.random().toString(36).slice(2, 10)}`);
  const notarizationTooltipText = getNotarizationTooltipText({
    notarizationHeight,
    notarizationLagBlocks,
    verusTipHeight
  });
  const notarizationTooltipLines = notarizationTooltipText ? notarizationTooltipText.split('\n') : [];
  const bridgeLabel = BLOCKCHAIN_NAME === 'VRSC' ? 'Verus' : BLOCKCHAIN_NAME;
  const ethIcon = getCurrencyIcon('ETH');
  const verusIcon = getCurrencyIcon(BLOCKCHAIN_NAME);

  useEffect(() => {
    if (!isTooltipOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (activityChipRef.current && !activityChipRef.current.contains(event.target)) {
        setIsTooltipOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsTooltipOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTooltipOpen]);

  const activityChip = (
    <div className={`${styles.infoChip} ${styles.activityChip}`} ref={activityChipRef}>
      <span className={styles.activityLabel}>Last confirmed bridge notarization:</span>
      <div className={styles.activityValueRow}>
        <span className={styles.activityValue}>{formatLagAgo(notarizationLagSeconds)}</span>
        {notarizationTooltipLines.length > 0 ? (
          <button
            aria-controls={isTooltipOpen ? popoverIdRef.current : undefined}
            aria-expanded={isTooltipOpen}
            aria-haspopup="dialog"
            aria-label="Show bridge notarization details"
            className={styles.activityInfoButton}
            onClick={() => setIsTooltipOpen((currentValue) => !currentValue)}
            type="button"
          >
            <InfoIcon />
          </button>
        ) : null}
      </div>
      {isTooltipOpen && notarizationTooltipLines.length > 0 ? (
        <div
          aria-label="Bridge notarization details"
          className={styles.activityPopover}
          id={popoverIdRef.current}
          role="dialog"
        >
          {notarizationTooltipLines.map((line, index) => (
            <div
              className={
                index === notarizationTooltipLines.length - 1 && notarizationTooltipLines.length > 1
                  ? `${styles.activityPopoverLine} ${styles.activityPopoverMetaLine}`
                  : styles.activityPopoverLine
              }
              key={line}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={styles.infoBar}>
      <div className={styles.infoBarInner}>
        <div className={styles.infoGroup}>
          <div className={styles.infoChip}>
            <div className={styles.infoChipIconGroup}>
              <img
                alt="Ethereum"
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt={bridgeLabel}
                className={styles.currencyIcon}
                src={verusIcon}
              />
            </div>
            <span className={styles.infoChipValue}>
              {renderFeeValue(baseBridgeFee ?? ethToVerusCost, ethUsdPrice)}
            </span>
          </div>

          <div className={styles.infoChip}>
            <div className={styles.infoChipIconGroup}>
              <img
                alt="Ethereum"
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt={bridgeLabel}
                className={styles.currencyIcon}
                src={verusIcon}
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt="Ethereum"
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src={ethIcon}
              />
            </div>
            <span className={styles.infoChipValue}>
              {renderFeeValue(bounceBackFee ?? verusToEthCost, ethUsdPrice)}
            </span>
          </div>
        </div>

        {activityChip}
      </div>
    </div>
  );
};

export default ReferenceInfoBar;
