import React from 'react';

import styles from '../../styles/SendStatus.module.css';

// Glyph paths in the 72 unit box (plan 3.2, "Status mark").
const GLYPHS = {
  bang: ['M36 23.5v15', 'M36 48.5v.1'],
  check: ['M22.5 37.5l9.5 9.5 18-20'],
  clock: ['M36 22.5V37l9.5 6'],
  cross: ['M27 27l18 18', 'M45 27L27 45']
};

const TONE_CLASS_NAMES = {
  danger: styles.toneDanger,
  warning: styles.toneWarning
};

// The mark of a send screen. `mark` is `spinner`, `wallet`, or a glyph name.
// The card's data-phase drives the settle: the spinner shows while `pending`,
// and the ring, disc, and glyph draw in when it becomes `done`.
const StatusMark = ({ isLive = false, mark, tone, walletIcon = null }) => {
  if (mark === 'wallet') {
    return (
      <div aria-hidden="true" className={styles.mark}>
        <span className={styles.pulse} />
        <span className={`${styles.pulse} ${styles.pulseLate}`} />
        <svg focusable="false" viewBox="0 0 72 72">
          <circle className={styles.walletTile} cx="36" cy="36" r="32" />
        </svg>
        {walletIcon ? <img alt="" className={styles.walletIcon} src={walletIcon} /> : null}
      </div>
    );
  }

  const glyph = GLYPHS[mark] || null;

  return (
    <div aria-hidden="true" className={[styles.mark, TONE_CLASS_NAMES[tone] || ''].join(' ').trim()}>
      <svg focusable="false" viewBox="0 0 72 72">
        <circle className={styles.track} cx="36" cy="36" r="32" />
        <circle className={styles.spin} cx="36" cy="36" r="32" />
        {glyph ? (
          <>
            <circle className={styles.ring} cx="36" cy="36" pathLength="1" r="32" />
            <circle className={styles.fill} cx="36" cy="36" r="32" />
            {glyph.map((path) => <path className={styles.glyph} d={path} key={path} pathLength="1" />)}
          </>
        ) : null}
      </svg>
      {glyph ? <span className={[styles.ripple, isLive ? styles.rippleLive : ''].join(' ').trim()} /> : null}
    </div>
  );
};

export default StatusMark;
