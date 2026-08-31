import React from 'react';

import { useThemeMode } from 'providers/ThemeModeProvider';

import styles from '../styles/ReferenceBridge.module.css';

const SunIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 2.75v2.5M12 18.75v2.5M4.75 12h-2.5M21.75 12h-2.5M5.76 5.76L4 4M20 20l-1.76-1.76M18.24 5.76L20 4M4 20l1.76-1.76"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </svg>
);

const MoonIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path
      d="M20.2 14.37A8.75 8.75 0 019.63 3.8a8.75 8.75 0 1010.57 10.57z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const THEME_OPTIONS = [
  { icon: null, label: 'Auto', value: 'system' },
  { icon: <SunIcon />, label: 'Light', value: 'light' },
  { icon: <MoonIcon />, label: 'Dark', value: 'dark' }
];

const SiteFooter = () => {
  const { mode, setMode } = useThemeMode();

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.siteFooterInner}>
        <p className={styles.siteFooterText}>
          Made by the Verus community with <span aria-hidden="true">💙</span>
        </p>

        <div className={styles.footerThemeControl}>
          <span className={styles.footerThemeLabel}>Theme</span>
          <div aria-label="Theme" className={styles.footerThemeSwitch} role="group">
            {THEME_OPTIONS.map((option) => {
              const isActive = mode === option.value;

              return (
                <button
                  aria-label={`${option.label} mode`}
                  aria-pressed={isActive}
                  className={[
                    styles.footerThemeOption,
                    option.icon ? styles.footerThemeOptionIconOnly : '',
                    isActive ? styles.footerThemeOptionActive : ''
                  ].filter(Boolean).join(' ')}
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  type="button"
                >
                  {option.icon}
                  <span className={option.icon ? styles.footerThemeOptionIconLabel : ''}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
