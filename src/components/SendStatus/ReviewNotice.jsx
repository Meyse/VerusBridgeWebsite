import React, { forwardRef } from 'react';

import styles from '../../styles/SendStatus.module.css';

const TONE_CLASS_NAMES = {
  danger: styles.noticeDanger,
  info: styles.noticeInfo,
  warning: styles.noticeWarning
};

const NoticeIcon = ({ tone }) => (
  <svg aria-hidden="true" className={styles.noticeIcon} fill="none" focusable="false" viewBox="0 0 18 18">
    <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.5" />
    {tone === 'info' ? (
      <path d="M9 8v4.25M9 5.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    ) : (
      <path d="M9 5.25V9.5M9 12.4v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    )}
  </svg>
);

// A notice above the main button (plan 3.2, "Notices"). N1 is a status; every
// other notice is an alert. The "Details" fold holds the raw message of N8.
const ReviewNotice = forwardRef(({ notice }, ref) => (
  <div
    className={[styles.notice, TONE_CLASS_NAMES[notice.tone] || styles.noticeWarning].join(' ')}
    data-notice-id={notice.id}
    ref={ref}
    role={notice.role}
    tabIndex={-1}
  >
    <NoticeIcon tone={notice.tone} />
    <div className={styles.noticeText}>
      <span className={styles.noticeTitle}>{notice.title}</span>
      {notice.body ? <span className={styles.noticeBody}>{notice.body}</span> : null}
      {notice.details ? (
        <details className={styles.noticeDetails}>
          <summary>Details</summary>
          <code>{notice.details}</code>
        </details>
      ) : null}
    </div>
  </div>
));

ReviewNotice.displayName = 'ReviewNotice';

export default ReviewNotice;
