import React from 'react';

import styles from 'styles/ReferenceBridge.module.css';

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
  const notarizationTooltipText = getNotarizationTooltipText({
    notarizationHeight,
    notarizationLagBlocks,
    verusTipHeight
  });

  const activityChip = (
    <div
      className={`${styles.infoChip} ${styles.activityChip}`}
      data-tooltip={notarizationTooltipText || undefined}
    >
      <span className={styles.activityLabel}>Last confirmed bridge notarization:</span>
      <span className={styles.activityValue}>{formatLagAgo(notarizationLagSeconds)}</span>
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
                src="/icons/currencies/eth.png"
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt="Verus"
                className={styles.currencyIcon}
                src="/icons/currencies/verus-icon-blue.svg"
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
                src="/icons/currencies/eth.png"
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt="Verus"
                className={styles.currencyIcon}
                src="/icons/currencies/verus-icon-blue.svg"
              />
              <span className={styles.infoChipArrow}>→</span>
              <img
                alt="Ethereum"
                className={`${styles.currencyIcon} ${styles.roundedIcon}`}
                src="/icons/currencies/eth.png"
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
