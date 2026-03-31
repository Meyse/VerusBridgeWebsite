import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '@mui/material';

import {
  buildDestinationCurrency,
  buildTokenCurrency,
  formatCompactAddress,
  getTokenDisplaySymbol
} from 'utils/bridgeUi';

import styles from '../styles/ReferenceBridge.module.css';

const ChevronIcon = ({ primary = false }) => (
  <img
    alt="Open currency selector"
    className={`${styles.selectorChevron} ${primary ? styles.selectorChevronPrimary : ''}`}
    src="/chevron.svg"
  />
);

const RouteIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
    <path
      d="M5 19a2 2 0 100-4 2 2 0 000 4zm14-14a2 2 0 100 4 2 2 0 000-4zm-2 2H9a4 4 0 00-4 4v4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const FuelIcon = () => (
  <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path
      d="M14 5h1a2 2 0 012 2v12H7V7a2 2 0 012-2h1m4 0V3h-4v2m4 0h-4m9 5l-2-2m2 2v5a2 2 0 01-2 2h-1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const CheckIcon = () => (
  <svg fill="none" height="12" viewBox="0 0 20 20" width="12">
    <path
      d="M5 10l3 3 7-7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
    />
  </svg>
);

const CloseIcon = () => (
  <svg fill="none" height="12" viewBox="0 0 20 20" width="12">
    <path
      d="M6 6l8 8M14 6l-8 8"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
    />
  </svg>
);

const CurrencyModal = ({
  currencies,
  isOpen,
  onClose,
  onSelect,
  searchTerm,
  setSearchTerm,
  title
}) => {
  const modalCardRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (modalCardRef.current && !modalCardRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredCurrencies = currencies.filter(
    (currency) => [currency.name, currency.symbol, currency.address, ...(currency.searchTerms || [])]
      .some((value) => (value || '').toLowerCase().includes(normalizedSearch))
  );

  return (
    <div className={styles.modalOverlay}>
      <div
        aria-label={title}
        aria-modal="true"
        className={styles.modalCard}
        ref={modalCardRef}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            aria-label="Close currency picker"
            className={styles.modalClose}
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <input
          className={styles.searchInput}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or paste address"
          type="text"
          value={searchTerm}
        />

        <div className={styles.currencyList}>
          {filteredCurrencies.length === 0 ? (
            <div className={styles.emptyState}>
              No currencies available yet. Enter a valid destination address to unlock receive options.
            </div>
          ) : (
            filteredCurrencies.map((currency) => (
              <button
                className={styles.currencyOption}
                key={currency.id}
                onClick={() => {
                  onSelect(currency.id);
                  onClose();
                }}
                type="button"
              >
                <div className={styles.currencyOptionLeft}>
                  <div className={styles.currencyOptionIconWrap}>
                    <img alt={currency.symbol} className={styles.currencyOptionIcon} src={currency.icon} />
                  </div>
                  <div className={styles.currencyOptionText}>
                    <div className={styles.currencyOptionName}>{currency.name}</div>
                    <div className={styles.currencyOptionMeta}>
                      <span className={styles.currencyOptionSymbol}>{currency.symbol}</span>
                      {currency.address ? (
                        <span className={styles.currencyOptionAddress}>
                          {formatCompactAddress(currency.address)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const formatAddressForInput = (address, isFocused) => {
  if (!address) {
    return '';
  }

  const shouldCompactHexAddress = !isFocused && address.startsWith('0x') && address.length === 42;
  return shouldCompactHexAddress ? formatCompactAddress(address) : address;
};

const BridgeCard = ({ controller }) => {
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationSelectorOpen, setDestinationSelectorOpen] = useState(false);
  const [displayAddress, setDisplayAddress] = useState(() => formatAddressForInput(controller.address, false));
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);

  const sourceCurrencies = useMemo(
    () => controller.tokenOptions.map((token) => buildTokenCurrency(token)),
    [controller.tokenOptions]
  );

  const destinationCurrencies = useMemo(
    () => controller.destinationOptions.map((option) => buildDestinationCurrency(option, controller.selectedToken)),
    [controller.destinationOptions, controller.selectedToken]
  );

  const selectedSourceCurrency = useMemo(
    () => (controller.selectedToken ? buildTokenCurrency(controller.selectedToken) : null),
    [controller.selectedToken]
  );

  const selectedDestinationCurrency = useMemo(
    () => (controller.selectedDestination ? buildDestinationCurrency(controller.selectedDestination, controller.selectedToken) : null),
    [controller.selectedDestination, controller.selectedToken]
  );

  useEffect(() => {
    setDisplayAddress(formatAddressForInput(controller.address, isAddressFocused));
  }, [controller.address, isAddressFocused]);

  const amountNumber = parseFloat(controller.amount);
  const estimatedAmountNumber = parseFloat(controller.estimatedDisplayValue);
  const hasPositiveAmount = !Number.isNaN(amountNumber) && amountNumber > 0;
  const hasEstimatedAmount = !Number.isNaN(estimatedAmountNumber) && estimatedAmountNumber > 0;
  const showPathInfo = controller.routeLabel === 'Ethereum -> Verus -> Ethereum';
  const showValidation = controller.address.length > 2;
  const isAddressValid = showValidation && !controller.addressError;
  const isAddressInvalid = showValidation && Boolean(controller.addressError);
  const showSelfButton = Boolean(controller.account);
  const isInsufficientBalance = Boolean(controller.amountError) && controller.amountError.includes('not available in your wallet');
  const addressInputClassName = [
    styles.addressInput,
    isAddressValid ? styles.addressInputValid : '',
    isAddressInvalid ? styles.addressInputInvalid : ''
  ]
    .filter(Boolean)
    .join(' ');
  const validationIconClassName = [
    styles.validationIcon,
    showSelfButton ? styles.validationIconWithSelf : '',
    isAddressValid ? styles.validationIconSuccess : styles.validationIconError
  ]
    .filter(Boolean)
    .join(' ');

  const exchangeRateText = useMemo(() => {
    if (!selectedSourceCurrency || !selectedDestinationCurrency || !hasPositiveAmount || !hasEstimatedAmount) {
      return '';
    }

    const rate = estimatedAmountNumber / amountNumber;
    return `1 ${selectedSourceCurrency.symbol} = ${rate.toFixed(2)} ${selectedDestinationCurrency.symbol}`;
  }, [
    amountNumber,
    estimatedAmountNumber,
    hasEstimatedAmount,
    hasPositiveAmount,
    selectedDestinationCurrency,
    selectedSourceCurrency
  ]);

  const submitState = useMemo(() => {
    if (!controller.isWalletConnected) {
      return { disabled: true, label: 'Connect your wallet' };
    }

    if (!controller.selectedToken) {
      return { disabled: true, label: 'Select currency to send' };
    }

    if (!controller.selectedDestination) {
      return { disabled: true, label: 'Select currency to receive' };
    }

    if (!hasPositiveAmount) {
      return { disabled: true, label: 'Choose amount' };
    }

    if (isInsufficientBalance) {
      return {
        disabled: true,
        label: `Not enough ${getTokenDisplaySymbol(controller.selectedToken) || controller.selectedToken.name}`
      };
    }

    return {
      disabled: !controller.canSubmit || controller.isTxPending,
      label: controller.isTxPending ? 'Submitting...' : 'Confirm conversion'
    };
  }, [
    controller.canSubmit,
    controller.isTxPending,
    controller.isWalletConnected,
    controller.selectedDestination,
    controller.selectedToken,
    hasPositiveAmount,
    isInsufficientBalance
  ]);

  return (
    <>
      <form
        className={styles.bridgeCard}
        id="bridge-interface"
        onSubmit={(event) => {
          event.preventDefault();
          controller.handleSubmit();
        }}
      >
        {controller.alert ? (
          <div className={styles.alert}>
            <Alert severity={controller.alert.severity}>{controller.alert.message}</Alert>
          </div>
        ) : null}

        <div className={styles.bridgeCardInner}>
          <div className={styles.cardSection}>
            <div className={styles.selector}>
              <div className={styles.selectorHeader}>
                <span className={styles.selectorLabel}>You send</span>
              </div>

              <div className={styles.selectorRow}>
                <div className={styles.selectorInputWrap}>
                  <input
                    className={styles.amountInput}
                    inputMode="decimal"
                    onChange={(event) => controller.setAmount(event.target.value)}
                    placeholder="0.00"
                    type="text"
                    value={controller.amount}
                  />
                </div>

                <button
                  className={styles.selectorButton}
                  onClick={() => setSourceSelectorOpen(true)}
                  type="button"
                >
                  {selectedSourceCurrency ? (
                    <>
                      <div className={styles.selectorIconWrap}>
                        <img alt={selectedSourceCurrency.symbol} className={styles.selectorIcon} src={selectedSourceCurrency.icon} />
                      </div>
                      <span className={styles.selectorButtonText}>{selectedSourceCurrency.symbol}</span>
                    </>
                  ) : (
                    <span className={styles.selectorButtonText}>Select currency</span>
                  )}
                  <ChevronIcon />
                </button>
              </div>

              {controller.isWalletConnected && controller.tokenBalance ? (
                <div className={styles.balanceDisplay}>
                  <div className={styles.balanceText}>
                    <span>{controller.tokenBalanceLabel}</span>
                    <button className={styles.maxButton} onClick={controller.handleMaxAmount} type="button">
                      Max
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${styles.cardSection} ${styles.cardSectionSecondary}`}>
            <div className={styles.selector}>
              <div className={styles.selectorHeader}>
                <span className={styles.selectorLabel}>You receive</span>
              </div>

              <div className={styles.selectorRow}>
                <div className={styles.selectorInputWrap}>
                  <input
                    className={`${styles.amountInput} ${styles.amountInputDisabled}`}
                    disabled
                    placeholder="0.00"
                    type="text"
                    value={hasEstimatedAmount ? controller.estimatedDisplayValue : ''}
                  />
                </div>

                <button
                  className={`${styles.selectorButton} ${selectedDestinationCurrency ? '' : styles.selectorButtonPrimary}`}
                  onClick={() => setDestinationSelectorOpen(true)}
                  type="button"
                >
                  {selectedDestinationCurrency ? (
                    <>
                      <div className={styles.selectorIconWrap}>
                        <img alt={selectedDestinationCurrency.symbol} className={styles.selectorIcon} src={selectedDestinationCurrency.icon} />
                      </div>
                      <span className={styles.selectorButtonText}>{selectedDestinationCurrency.symbol}</span>
                    </>
                  ) : (
                    <span className={styles.selectorButtonTextPrimary}>Select currency</span>
                  )}
                  <ChevronIcon primary={!selectedDestinationCurrency} />
                </button>
              </div>

              <div className={styles.rates}>
                {showPathInfo ? (
                  <div className={styles.pathInfo}>
                    <RouteIcon />
                    <span>Path: Ethereum → Verus → Ethereum</span>
                  </div>
                ) : null}

                {(exchangeRateText || controller.feeEstimate) ? (
                  <div className={styles.rateRow}>
                    <div className={styles.rateText}>
                      {exchangeRateText || <span className={styles.rateTextMuted}>{controller.routeLabel}</span>}
                    </div>
                    <div className={styles.rateFee}>
                      <span className={styles.rateIcon}>
                        <FuelIcon />
                      </span>
                      <span>{controller.feeEstimate}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.addressBlock}>
          <div className={styles.addressHint}>Enter a Verus address (R-address or i-address) or Ethereum address</div>
          <div className={styles.addressWrapper}>
            <input
              className={addressInputClassName}
              onBlur={() => {
                setIsAddressFocused(false);
                setDisplayAddress(formatAddressForInput(controller.address, false));
              }}
              onChange={(event) => {
                setDisplayAddress(event.target.value);
                controller.setAddress(event.target.value);
              }}
              onFocus={() => {
                setIsAddressFocused(true);
                setDisplayAddress(controller.address);
              }}
              placeholder="Enter receiving address"
              type="text"
              value={displayAddress}
            />

            {showSelfButton ? (
              <button
                className={styles.selfButton}
                onClick={() => controller.setAddress(controller.account)}
                type="button"
              >
                self
              </button>
            ) : null}

            {showValidation ? (
              <div className={validationIconClassName}>
                {isAddressValid ? <CheckIcon /> : <CloseIcon />}
              </div>
            ) : null}
          </div>
        </div>

        <button
          className={`${styles.submitButton} ${submitState.disabled ? styles.submitButtonDisabled : ''}`}
          disabled={submitState.disabled}
          type="submit"
        >
          {submitState.label}
        </button>
      </form>

      <CurrencyModal
        currencies={sourceCurrencies}
        isOpen={sourceSelectorOpen}
        onClose={() => setSourceSelectorOpen(false)}
        onSelect={controller.selectToken}
        searchTerm={sourceSearch}
        setSearchTerm={setSourceSearch}
        title="Select a currency"
      />

      <CurrencyModal
        currencies={destinationCurrencies}
        isOpen={destinationSelectorOpen}
        onClose={() => setDestinationSelectorOpen(false)}
        onSelect={controller.selectDestination}
        searchTerm={destinationSearch}
        setSearchTerm={setDestinationSearch}
        title="Select a currency"
      />
    </>
  );
};

export default BridgeCard;
