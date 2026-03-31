import React, { useEffect, useMemo, useRef, useState } from 'react';

import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import { NoEthereumProviderError, UserRejectedRequestError } from '@web3-react/injected-connector';
import { Link, useLocation } from 'react-router-dom';

import { getExplorerBaseUrl } from 'config/explorerLinks';
import { injectedConnector } from 'connectors/injectedConnector';
import { formatCompactAddress } from 'utils/bridgeUi';
import {
  clearInjectedWalletAutoConnectSuppression,
  suppressInjectedWalletAutoConnect
} from 'utils/walletConnection';

import { useToast } from './Toast/ToastProvider';
import WalletConnectDialog from './WalletConnectDialog';
import styles from '../styles/ReferenceBridge.module.css';

const NAV_ITEMS = [
  { label: 'Truly trustless', to: '/#trustless-section' },
  { label: 'Bridge transactions', to: '/#bridge-interface' },
  { label: 'FAQ', to: '/#resources' },
  { label: 'Refunds', to: '/claim' }
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

const SiteHeader = () => {
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
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
  }, [location.pathname, location.hash]);

  const walletLabel = useMemo(() => formatCompactAddress(account), [account]);

  const handleConfirmWallet = async () => {
    try {
      await activate(injectedConnector);
      clearInjectedWalletAutoConnectSuppression();
    } catch (connectError) {
      // The connector error is surfaced through the web3-react context.
    } finally {
      setWalletDialogOpen(false);
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
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.headerLeft}>
          <Link className={styles.headerTitle} to="/">
            Verus-Ethereum Bridge
          </Link>

          <nav aria-label="Primary" className={styles.headerNav}>
            {NAV_ITEMS.map((item) => (
              <Link className={styles.headerNavLink} key={item.label} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.walletGroup} ref={dropdownRef}>
          {!account ? (
            <button
              className={styles.connectButton}
              onClick={() => setWalletDialogOpen(true)}
              type="button"
            >
              Connect wallet
            </button>
          ) : (
            <>
              <button
                className={styles.connectedButton}
                onClick={() => setShowDropdown((currentValue) => !currentValue)}
                type="button"
              >
                <span className={styles.connectedLabel}>{walletLabel}</span>
              </button>

              {showDropdown ? (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownKicker}>Connected with MetaMask</div>
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
            <Link className={styles.mobileNavLink} key={item.label} to={item.to}>
              {item.label}
            </Link>
          ))}
          <Link className={styles.mobileNavLink} to="/nft">
            NFT bridge
          </Link>
        </div>
      ) : null}

      <WalletConnectDialog
        isOpen={walletDialogOpen}
        onClose={() => setWalletDialogOpen(false)}
        onConfirm={handleConfirmWallet}
      />
    </header>
  );
};

export default SiteHeader;
