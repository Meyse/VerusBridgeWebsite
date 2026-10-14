import React, { useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { WALLET_HINT_DELAY_MS } from 'utils/sendScreens';

import bridgeStyles from '../../styles/ReferenceBridge.module.css';
import styles from '../../styles/SendStatus.module.css';
import InlineConfirm from './InlineConfirm';
import StatusMark from './StatusMark';

const TEXT_SWAP_MS = 400;
const COPIED_LABEL_MS = 2000;

const ExternalIcon = () => (
  <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 12 12">
    <path d="M4.5 2.5h5v5M9.5 2.5 3 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
  </svg>
);

const ExplorerLink = ({ href, children }) => (
  <a className={styles.link} href={href} rel="noopener noreferrer" target="_blank">
    {children}
    <ExternalIcon />
  </a>
);

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const getScreenKey = (screen) => [screen.id, screen.mark, screen.title, screen.body].join('|');

const DetailRow = ({ row }) => {
  let value = row.value;

  if (row.links) {
    value = (
      <span className={styles.rowLinks}>
        {row.links.filter((link) => link.href).map((link) => (
          <ExplorerLink href={link.href} key={link.href}>{link.label}</ExplorerLink>
        ))}
      </span>
    );
  } else if (row.href) {
    value = <ExplorerLink href={row.href}>{row.value}</ExplorerLink>;
  }

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{row.label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
};

// The status card that replaces Review after Confirm (plan 3.2, design A). It
// renders one screen of the screen model. A live result settles with the
// mark animation; a restored screen shows its settled state at once.
const SendStatusCard = ({
  busyAction = null,
  canMutateRecords = true,
  copyDetailsText = '',
  onAction,
  screen,
  walletIcon = null
}) => {
  const screenKey = getScreenKey(screen);
  const [shown, setShown] = useState({
    body: screen.body, key: screenKey, mark: screen.mark, title: screen.title
  });
  const [phase, setPhase] = useState(screen.mark === 'spinner' ? 'pending' : 'done');
  const [isLive, setIsLive] = useState(false);
  const [settleToken, setSettleToken] = useState(0);
  const [leavingText, setLeavingText] = useState(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [hintKey, setHintKey] = useState(null);
  const titleRef = useRef(null);
  const clearButtonRef = useRef(null);
  const restoreClearFocusRef = useRef(false);

  // A new screen: decide the transition while rendering, so the first frame
  // of the new screen already has the right phase.
  if (shown.key !== screenKey) {
    const reducedMotion = prefersReducedMotion();
    setShown({
      body: screen.body, key: screenKey, mark: screen.mark, title: screen.title
    });
    setIsConfirmingClear(false);
    setCopyState('idle');

    if (screen.mark === 'spinner') {
      setPhase('pending');
      setIsLive(false);
    } else if (shown.mark === 'spinner' && !reducedMotion) {
      // The phase stays `pending`, so the new glyph mounts hidden. Two frames
      // later it settles.
      setIsLive(true);
      setSettleToken((token) => token + 1);
    } else {
      setPhase('done');
    }

    setLeavingText(!reducedMotion && (shown.title !== screen.title || shown.body !== screen.body)
      ? { body: shown.body, key: shown.key, title: shown.title }
      : null);
  }

  useEffect(() => {
    if (!settleToken) {
      return undefined;
    }

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPhase('done'));
    });
    return () => cancelAnimationFrame(frame);
  }, [settleToken]);

  useEffect(() => {
    if (!leavingText) {
      return undefined;
    }

    const timer = setTimeout(() => setLeavingText(null), TEXT_SWAP_MS);
    return () => clearTimeout(timer);
  }, [leavingText]);

  // A screen that opens while focus has nowhere to go (the Review or form that
  // held it is gone) moves focus to its title. Otherwise focus stays.
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      titleRef.current?.focus();
    }
  }, []);

  // W1 and W2: the hint shows 15 s after the screen (WALLET_HINT_DELAY_MS).
  useEffect(() => {
    if (!screen.hint) {
      return undefined;
    }

    const timer = setTimeout(() => setHintKey(screenKey), WALLET_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [screen.hint, screenKey]);

  useEffect(() => {
    if (!isConfirmingClear && restoreClearFocusRef.current) {
      restoreClearFocusRef.current = false;
      clearButtonRef.current?.focus();
    }
  }, [isConfirmingClear]);

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(copyDetailsText);
      setCopyState('copied');
      setTimeout(() => setCopyState((current) => (current === 'copied' ? 'idle' : current)), COPIED_LABEL_MS);
    } catch (error) {
      setCopyState('failed');
    }
  };

  const renderAction = (action, kind) => {
    if (!action) {
      return null;
    }

    const className = kind === 'primary'
      ? `${bridgeStyles.submitButton} ${styles.primary}`
      : styles.quiet;

    if (action.action === 'openExplorer') {
      return action.href ? (
        <a className={className} href={action.href} rel="noopener noreferrer" target="_blank">{action.label}</a>
      ) : null;
    }

    if (action.action === 'viewActivity') {
      return <Link className={className} to="/activity">{action.label}</Link>;
    }

    if (action.action === 'copyDetails') {
      return (
        <button className={className} onClick={copyDetails} type="button">
          {copyState === 'copied' ? 'Copied' : action.label}
        </button>
      );
    }

    if (action.action === 'clearRecord') {
      return (
        <button
          className={className}
          disabled={!canMutateRecords}
          onClick={() => setIsConfirmingClear(true)}
          ref={clearButtonRef}
          type="button"
        >
          {action.label}
        </button>
      );
    }

    const isBusy = busyAction === action.action;

    return (
      <button className={className} disabled={isBusy} onClick={() => onAction(action.action)} type="button">
        {isBusy && kind === 'primary' ? <span aria-hidden="true" className={bridgeStyles.buttonSpinner} /> : null}
        <span>{action.label}</span>
      </button>
    );
  };

  const hasActions = Boolean(screen.primary || screen.quiet);

  return (
    <div className={`${bridgeStyles.bridgeCard} ${styles.card}`} data-phase={phase} data-screen-id={screen.id} id="bridge-interface">
      <section className={styles.hero}>
        <StatusMark isLive={isLive} mark={screen.mark} tone={screen.tone} walletIcon={walletIcon} />
        <div className={styles.copy}>
          <div aria-atomic="true" aria-live="polite" className={styles.copy}>
            <div className={styles.swap}>
              {leavingText ? (
                <p aria-hidden="true" className={`${styles.title} ${styles.leaving}`} key={`${leavingText.key}-title`}>
                  {leavingText.title}
                </p>
              ) : null}
              <h2
                className={`${styles.title} ${styles.titleFocus} ${leavingText ? styles.entering : ''}`}
                key={`${screenKey}-title`}
                ref={titleRef}
                tabIndex={-1}
              >
                {screen.title}
              </h2>
            </div>
            {screen.body || leavingText?.body ? (
              <div className={styles.swap}>
                {leavingText?.body ? (
                  <p aria-hidden="true" className={`${styles.body} ${styles.leaving}`} key={`${leavingText.key}-body`}>
                    {leavingText.body}
                  </p>
                ) : null}
                <p className={`${styles.body} ${leavingText ? styles.entering : ''}`} key={`${screenKey}-body`}>
                  {screen.body}
                </p>
              </div>
            ) : null}
          </div>
          {screen.steps ? (
            <div aria-hidden="true" className={styles.steps}>
              {Array.from({ length: screen.steps.total }, (_, index) => (
                <i className={`${styles.step} ${index < screen.steps.current ? styles.stepOn : ''}`} key={index} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {screen.rows.length > 0 ? (
        <div className={styles.details}>
          {screen.rows.map((row) => <DetailRow key={row.label} row={row} />)}
        </div>
      ) : null}

      {screen.hint && hintKey === screenKey ? <p className={styles.hint}>{screen.hint}</p> : null}

      {hasActions && isConfirmingClear ? (
        <InlineConfirm
          confirmLabel="Clear"
          disabled={!canMutateRecords || busyAction === 'clearRecord'}
          onCancel={() => {
            restoreClearFocusRef.current = true;
            setIsConfirmingClear(false);
          }}
          onConfirm={() => onAction('clearRecord')}
        />
      ) : null}

      {hasActions && !isConfirmingClear ? (
        <div className={`${styles.actions} ${isLive ? styles.actionsLive : ''}`}>
          {renderAction(screen.primary, 'primary')}
          {renderAction(screen.quiet, 'quiet')}
        </div>
      ) : null}

      {copyState === 'failed' ? <pre className={styles.copyFallback}>{copyDetailsText}</pre> : null}
    </div>
  );
};

export default SendStatusCard;
