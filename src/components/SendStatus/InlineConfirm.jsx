import React, { useEffect, useRef } from 'react';

import styles from '../../styles/SendStatus.module.css';

export const DUPLICATE_WARNING = 'If the first transfer still goes through, you will bridge twice.';

// The duplicate warning that replaces the actions (plan 3.2, Actions). Focus
// moves to its text when it opens.
const InlineConfirm = ({ confirmLabel, disabled = false, onCancel, onConfirm }) => {
  const textRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  return (
    <div className={styles.inlineConfirm}>
      <p ref={textRef} tabIndex={-1}>{DUPLICATE_WARNING}</p>
      <div className={styles.inlineActions}>
        <button className={styles.confirmButton} disabled={disabled} onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
        <button className={styles.quiet} onClick={onCancel} type="button">Cancel</button>
      </div>
    </div>
  );
};

export default InlineConfirm;
