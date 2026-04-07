import React, { useEffect, useMemo, useRef, useState } from 'react';

import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import { NoEthereumProviderError, UserRejectedRequestError } from '@web3-react/injected-connector';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getExplorerBaseUrl } from 'config/explorerLinks';
import { injectedConnector } from 'connectors/injectedConnector';
import { formatCompactAddress } from 'utils/bridgeUi';
import {
  HOME_INFO_HASH,
  HOME_INFO_SECTION_ID,
  HOME_REVIEW_STEP,
  buildHomeHref,
  buildHomeLocation,
  getHomeStep,
  scrollToHomeSection
} from 'utils/homeNavigation';
import {
  clearInjectedWalletAutoConnectSuppression,
  suppressInjectedWalletAutoConnect
} from 'utils/walletConnection';

import { useToast } from './Toast/ToastProvider';
import { ReactComponent as MetaMaskIcon } from '../images/icons/metamask-icon.svg';
import styles from '../styles/ReferenceBridge.module.css';

const NAV_ITEMS = [
  { id: 'bridge', label: 'Bridge' },
  { id: 'info', label: 'Info' },
  { id: 'claim', label: 'Refunds & earnings', to: '/claim' }
];

const CopyIcon = ({ copied }) => (
  <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
    {copied ? (
      <path
        d="M5 12l4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    ) : (
      <>
        <rect height="11" rx="2" stroke="currentColor" strokeWidth="2" width="11" x="9" y="9" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" />
      </>
    )}
  </svg>
);

const ExternalLinkIcon = () => (
  <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path
      d="M14 4h6m0 0v6m0-6L10 14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path
      d="M20 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const MenuIcon = () => (
  <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
    <path
      d="M4 6h16M4 12h16M4 18h16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const WALLET_OPTIONS = [
  {
    id: 'metamask',
    title: 'MetaMask',
    icon: <MetaMaskIcon />
  }
];

const SiteHeader = () => {
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(() => (typeof window !== 'undefined' ? window.scrollY > 0 : false));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const headerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { account, activate, deactivate, error } = useWeb3React();
  const { addToast } = useToast();

  useEffect(() => {
    if (error instanceof NoEthereumProviderError) {
      addToast({ type: 'error', description: 'Ethereum provider not found.' });
    } else if (error instanceof UserRejectedRequestError) {
      addToast({ type: 'error', description: 'Wallet connection request rejected.' });
    } else if (error instanceof UnsupportedChainIdError) {
      addToast({ type: 'error', description: 'Switch MetaMask to Ethereum mainnet or Sepolia.' });
    }
  }, [addToast, error]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !headerRef.current) {
      return undefined;
    }

    const rootStyle = document.documentElement.style;
    const updateHeaderHeight = () => {
      rootStyle.setProperty('--site-header-height', `${headerRef.current?.offsetHeight || 0}px`);
    };

    updateHeaderHeight();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeaderHeight);
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
      rootStyle.removeProperty('--site-header-height');
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setShowDropdown(false);
  }, [location.hash, location.pathname, location.search]);

  const walletLabel = useMemo(() => formatCompactAddress(account), [account]);
  const homeStep = useMemo(() => getHomeStep(location.search), [location.search]);
  const isHomeRoute = location.pathname === '/';
  const isReviewRequested = homeStep === HOME_REVIEW_STEP;
  const bridgeHref = useMemo(() => buildHomeHref(), []);
  const infoHref = useMemo(() => buildHomeHref({ hash: HOME_INFO_HASH }), []);

  const handleConfirmWallet = async () => {
    try {
      await activate(injectedConnector);
      clearInjectedWalletAutoConnectSuppression();
    } catch (connectError) {
      // The connector error is surfaced through the web3-react context.
    } finally {
      setShowDropdown(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!account) {
      return;
    }

    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      addToast({ type: 'error', description: 'Failed to copy address.' });
    }
  };

  const handleOpenExplorer = () => {
    if (!account) {
      return;
    }

    window.open(`${getExplorerBaseUrl()}/address/${account}`, '_blank', 'noopener,noreferrer');
    setShowDropdown(false);
  };

  const handleBridgeClick = (event) => {
    if (!isHomeRoute || typeof window === 'undefined') {
      return;
    }

    event.preventDefault();

    if (location.search || location.hash) {
      navigate(buildHomeLocation({ search: location.search }), { replace: isReviewRequested });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInfoClick = (event) => {
    if (!isHomeRoute) {
      return;
    }

    event.preventDefault();

    const nextLocation = buildHomeLocation({
      hash: HOME_INFO_HASH,
      search: location.search
    });
    const isSameLocation = location.search === nextLocation.search && location.hash === nextLocation.hash;

    if (isSameLocation) {
      scrollToHomeSection(HOME_INFO_SECTION_ID);
      return;
    }

    navigate(nextLocation, { replace: isReviewRequested });
  };

  const getNavItemHref = (item) => {
    if (item.id === 'bridge') {
      return bridgeHref;
    }

    if (item.id === 'info') {
      return infoHref;
    }

    return item.to;
  };

  const getNavItemClickHandler = (item) => {
    if (item.id === 'bridge') {
      return handleBridgeClick;
    }

    if (item.id === 'info') {
      return handleInfoClick;
    }

    return undefined;
  };

  return (
    <header
      className={isScrolled ? `${styles.header} ${styles.headerScrolled}` : styles.header}
      ref={headerRef}
    >
      <div className={styles.headerInner}>
        <div className={styles.headerLeft}>
          <Link className={styles.headerTitle} onClick={handleBridgeClick} to={bridgeHref}>
            Verus-Ethereum Bridge
          </Link>

          <nav aria-label="Primary" className={styles.headerNav}>
            {NAV_ITEMS.map((item) => (
              <Link
                className={styles.headerNavLink}
                key={item.label}
                onClick={getNavItemClickHandler(item)}
                to={getNavItemHref(item)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.walletGroup} ref={dropdownRef}>
          {!account ? (
            <>
              <button
                aria-expanded={showDropdown}
                className={styles.connectButton}
                onClick={() => setShowDropdown((currentValue) => !currentValue)}
                type="button"
              >
                <span>Connect wallet</span>
              </button>

              {showDropdown ? (
                <div aria-label="Wallet connection options" className={styles.dropdown}>
                  <div className={styles.walletOptionList}>
                    {WALLET_OPTIONS.map((walletOption) => (
                      <button
                        className={styles.walletOption}
                        key={walletOption.id}
                        onClick={handleConfirmWallet}
                        type="button"
                      >
                        <span className={styles.walletOptionIconWrap}>{walletOption.icon}</span>
                        <span className={styles.walletOptionTitle}>{walletOption.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <button
                aria-expanded={showDropdown}
                className={showDropdown ? `${styles.connectedButton} ${styles.connectedButtonActive}` : styles.connectedButton}
                onClick={() => setShowDropdown((currentValue) => !currentValue)}
                type="button"
              >
                <span className={styles.connectedLabel}>{walletLabel}</span>
              </button>

              {showDropdown ? (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownKicker}>Connected wallet</div>
                    <div className={styles.dropdownAddressRow}>
                      <div className={styles.dropdownAddress}>{account}</div>
                      <button
                        aria-label="Copy address"
                        className={styles.copyButton}
                        onClick={handleCopyAddress}
                        title="Copy address"
                        type="button"
                      >
                        <CopyIcon copied={copied} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.dropdownActions}>
                    <button className={styles.dropdownAction} onClick={handleOpenExplorer} type="button">
                      <ExternalLinkIcon />
                      <span>View on Etherscan</span>
                    </button>
                    <button
                      className={`${styles.dropdownAction} ${styles.dropdownActionDanger}`}
                      onClick={() => {
                        suppressInjectedWalletAutoConnect();
                        deactivate();
                        setShowDropdown(false);
                      }}
                      type="button"
                    >
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <button
          aria-label="Open navigation"
          className={styles.mobileMenuButton}
          onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
          type="button"
        >
          <MenuIcon />
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className={styles.mobileNavPanel}>
          {NAV_ITEMS.map((item) => (
            <Link
              className={styles.mobileNavLink}
              key={item.label}
              onClick={getNavItemClickHandler(item)}
              to={getNavItemHref(item)}
            >
              {item.label}
            </Link>
          ))}
          <Link className={styles.mobileNavLink} to="/nft">
            NFT bridge
          </Link>
        </div>
      ) : null}
    </header>
  );
};

export default SiteHeader;
