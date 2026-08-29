import React, { useEffect, useMemo, useRef, useState } from 'react';

import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import { NoEthereumProviderError, UserRejectedRequestError } from '@web3-react/injected-connector';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getExplorerBaseUrl } from 'config/explorerLinks';
import { injectedConnector } from 'connectors/injectedConnector';
import { ETHEREUM_BLOCKCHAIN_NAME, TESTNET } from 'constants/contractAddress';
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
  REFUND_ADDRESS_STATE_EVENT,
  REFUND_ADDRESS_STATUS_FAILED,
  REFUND_ADDRESS_STATUS_REQUIRED,
  getCachedRefundAddress,
  getRefundAddressSignatureStatus,
  requestAndCacheRefundAddressData,
  setRefundAddressSignatureStatus
} from 'utils/refundAddress';
import {
  clearInjectedWalletAutoConnectSuppression,
  suppressInjectedWalletAutoConnect
} from 'utils/walletConnection';
import { requestExpectedWalletChain } from 'utils/walletNetwork';

import { useToast } from './Toast/ToastProvider';
import MetaMaskIcon from '../images/icons/metamask-icon.svg?react';
import styles from '../styles/ReferenceBridge.module.css';

const NAV_ITEMS = [
  { id: 'bridge', label: 'Bridge' },
  { id: 'info', label: 'Info' },
  { id: 'claim', label: TESTNET ? 'Refunds' : 'Refunds & earnings', to: '/claim' }
];

const ALTERNATE_BRIDGE = TESTNET
  ? { label: 'Switch to Mainnet', origin: 'https://bridge.vaultalert.net' }
  : { label: 'Switch to Testnet', origin: 'https://testbridge.vaultalert.net' };

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

const AlertIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
    <path
      d="M12 8v5m0 4h.01M10.3 3.9L2.8 17.2A2 2 0 004.5 20h15a2 2 0 001.7-2.8L13.7 3.9a2 2 0 00-3.4 0z"
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
  const [isRetryingRefundSignature, setIsRetryingRefundSignature] = useState(false);
  const [isScrolled, setIsScrolled] = useState(() => (typeof window !== 'undefined' ? window.scrollY > 0 : false));
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refundSignatureStatus, setRefundSignatureStatus] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const headerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { account, activate, deactivate, error } = useWeb3React();
  const { addToast } = useToast();
  const isWrongNetwork = error instanceof UnsupportedChainIdError;

  useEffect(() => {
    if (error instanceof NoEthereumProviderError) {
      addToast({ type: 'error', description: 'Ethereum provider not found.' });
    } else if (error instanceof UserRejectedRequestError) {
      addToast({ type: 'error', description: 'Wallet connection request rejected.' });
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
  const alternateBridgeHref = `${ALTERNATE_BRIDGE.origin}${location.pathname}`;
  const needsRefundSignatureAction = Boolean(
    account
    && !getCachedRefundAddress(account)
    && [REFUND_ADDRESS_STATUS_FAILED, REFUND_ADDRESS_STATUS_REQUIRED].includes(refundSignatureStatus)
  );

  useEffect(() => {
    const refreshRefundSignatureStatus = () => {
      if (!account || getCachedRefundAddress(account)) {
        setRefundSignatureStatus('');
        setIsRetryingRefundSignature(false);
        return;
      }

      setRefundSignatureStatus(getRefundAddressSignatureStatus(account));
    };

    refreshRefundSignatureStatus();
    window.addEventListener(REFUND_ADDRESS_STATE_EVENT, refreshRefundSignatureStatus);
    window.addEventListener('storage', refreshRefundSignatureStatus);

    return () => {
      window.removeEventListener(REFUND_ADDRESS_STATE_EVENT, refreshRefundSignatureStatus);
      window.removeEventListener('storage', refreshRefundSignatureStatus);
    };
  }, [account]);

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

  const handleSwitchNetwork = async () => {
    setIsSwitchingNetwork(true);

    try {
      await requestExpectedWalletChain(window.ethereum);
      await activate(injectedConnector, undefined, true);
      clearInjectedWalletAutoConnectSuppression();
      addToast({ type: 'success', description: `MetaMask switched to ${ETHEREUM_BLOCKCHAIN_NAME}.` });
    } catch (switchError) {
      addToast({
        type: 'error',
        description: switchError?.code === 4001
          ? 'Network switch request rejected.'
          : switchError?.message || `Could not switch MetaMask to ${ETHEREUM_BLOCKCHAIN_NAME}.`
      });
    } finally {
      setIsSwitchingNetwork(false);
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

  const handleRetryRefundSigning = async () => {
    if (!account) {
      return;
    }

    setIsRetryingRefundSignature(true);

    try {
      await requestAndCacheRefundAddressData(account);
      setRefundSignatureStatus('');
      addToast({ type: 'success', description: 'Public key signature confirmed.' });
    } catch (signingError) {
      setRefundAddressSignatureStatus(account, REFUND_ADDRESS_STATUS_FAILED);
      setRefundSignatureStatus(REFUND_ADDRESS_STATUS_FAILED);
      addToast({
        type: 'error',
        description: signingError.message || 'Public key signature was not completed.'
      });
    } finally {
      setIsRetryingRefundSignature(false);
    }
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
            <a className={styles.headerNavLink} href={alternateBridgeHref}>
              {ALTERNATE_BRIDGE.label}
            </a>
          </nav>
        </div>

        <div className={styles.headerRight}>
          {isWrongNetwork ? (
            <div aria-label="Wallet network status" className={styles.networkNotice} role="alert">
              <AlertIcon />
              <span>Wrong network</span>
            </div>
          ) : null}

          <div className={styles.walletGroup} ref={dropdownRef}>
            {isWrongNetwork ? (
              <button
                className={styles.connectButton}
                disabled={isSwitchingNetwork}
                onClick={handleSwitchNetwork}
                type="button"
              >
                {isSwitchingNetwork ? 'Switching...' : `Switch to ${ETHEREUM_BLOCKCHAIN_NAME}`}
              </button>
            ) : null}

            {!isWrongNetwork && !account ? (
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
            ) : null}

            {!isWrongNetwork && account ? (
              <>
                <button
                  aria-expanded={showDropdown}
                  className={showDropdown ? `${styles.connectedButton} ${styles.connectedButtonActive}` : styles.connectedButton}
                  onClick={() => setShowDropdown((currentValue) => !currentValue)}
                  type="button"
                >
                  <span className={styles.connectedLabel}>{walletLabel}</span>
                  {needsRefundSignatureAction ? (
                    <span
                      aria-label="Public key signature required"
                      className={styles.connectedAlertIcon}
                      role="img"
                      title="Public key signature required"
                    >
                      <AlertIcon />
                    </span>
                  ) : null}
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

                    {needsRefundSignatureAction ? (
                      <div className={styles.walletNotice} role="alert">
                        <div className={styles.walletNoticeHeader}>
                          <span>Public key signature needed</span>
                        </div>
                        <button
                          className={styles.walletNoticeAction}
                          disabled={isRetryingRefundSignature}
                          onClick={handleRetryRefundSigning}
                          type="button"
                        >
                          {isRetryingRefundSignature ? 'Waiting for signature...' : 'Retry signing'}
                        </button>
                      </div>
                    ) : null}

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
            ) : null}
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
      </div>

      {TESTNET ? (
        <div aria-label="Testnet environment" className={styles.testnetNotice} role="status">
          <strong>TESTNET</strong>
          <span>Sepolia ↔ VRSCTEST · Test assets have no real-world value</span>
        </div>
      ) : null}

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
          <a className={styles.mobileNavLink} href={alternateBridgeHref}>
            {ALTERNATE_BRIDGE.label}
          </a>
        </div>
      ) : null}
    </header>
  );
};

export default SiteHeader;
