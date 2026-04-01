import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '@mui/material';

import {
  buildDestinationCurrency,
  buildTokenCurrency,
  formatCompactAddress,
  getTokenDisplaySymbol,
  sortSourceCurrencies
} from 'utils/bridgeUi';

import styles from '../styles/ReferenceBridge.module.css';

const ChevronIcon = ({ primary = false }) => (
  <img
    alt="Open currency selector"
    className={`${styles.selectorChevron} ${primary ? styles.selectorChevronPrimary : ''}`}
    src="/chevron.svg"
  />
);

const RouteArrowIcon = () => (
  <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 20 12" width="20">
    <path
      d="M1.5 6h14m0 0-4-4m4 4-4 4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
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

const EditIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 20 20" width="14">
    <path
      d="M4 13.75V16h2.25l8.46-8.46-2.25-2.25L4 13.75zm9.79-9.21l2.25 2.25 1-1a1 1 0 000-1.41l-.84-.84a1 1 0 00-1.41 0l-1 1z"
      fill="currentColor"
    />
  </svg>
);

const InfoIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 7v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <circle cx="8" cy="4.75" fill="currentColor" r="0.75" />
  </svg>
);

const ModalCloseIcon = () => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <path
      d="M4.5 4.5l11 11m0-11l-11 11"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const SearchIcon = () => (
  <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
    <path
      d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const CurrencyModal = ({
  currencies,
  emptyStateMessage = 'No currencies available yet.',
  isLoading = false,
  loadingMessage = 'Loading currencies...',
  isOpen,
  onClose,
  onSelect,
  onStatusAction,
  searchTerm,
  setSearchTerm,
  statusActionLabel,
  statusMessage,
  statusTone = 'info',
  title
}) => {
  const modalCardRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    searchInputRef.current?.focus();

    const handlePointerDown = (event) => {
      if (modalCardRef.current && !modalCardRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
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
            <ModalCloseIcon />
          </button>
        </div>

        <div className={styles.searchInputWrap}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            aria-label="Search currencies"
            autoComplete="off"
            className={styles.searchInput}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name or paste address"
            ref={searchInputRef}
            spellCheck={false}
            type="text"
            value={searchTerm}
          />
        </div>

        {statusMessage ? (
          <div
            className={`${styles.modalStatus} ${statusTone === 'warning' ? styles.modalStatusWarning : styles.modalStatusInfo}`}
            role={statusTone === 'warning' ? 'alert' : 'status'}
          >
            <span>{statusMessage}</span>
            {statusActionLabel && onStatusAction ? (
              <button
                className={styles.modalStatusAction}
                onClick={onStatusAction}
                type="button"
              >
                {statusActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.currencyList}>
          {filteredCurrencies.length === 0 ? (
            <div className={styles.emptyState}>
              {isLoading ? loadingMessage : emptyStateMessage}
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
                {currency.balanceLabel || currency.fiatLabel ? (
                  <div className={styles.currencyOptionRight}>
                    {currency.fiatLabel ? (
                      <div className={styles.currencyOptionValue}>{currency.fiatLabel}</div>
                    ) : null}
                    {currency.balanceLabel ? (
                      <div className={currency.fiatLabel ? styles.currencyOptionBalance : styles.currencyOptionBalanceOnly}>
                        {currency.balanceLabel}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

const StaticCurrencyPill = ({ currency }) => {
  if (!currency) {
    return null;
  }

  return (
    <div className={`${styles.selectorButton} ${styles.selectorButtonWithIcon} ${styles.reviewCurrencyPill}`}>
      <div className={styles.selectorIconWrap}>
        <img alt={currency.symbol} className={styles.selectorIcon} src={currency.icon} />
      </div>
      <span className={styles.selectorButtonText}>{currency.symbol}</span>
    </div>
  );
};

const RECEIVE_ESTIMATE_TOOLTIP_LINES = [
  'This amount is estimated and not guaranteed.',
  'Bridging and conversion settle over time, so the final value can shift before completion.'
];

const REVIEW_TIME_TOOLTIP_LINES = [
  'More activity on the bridge can help transfers complete faster.',
  'Because the bridge protocol settles in a decentralized way, completion can still take a while.'
];

const splitRouteLabel = (routeLabel) => String(routeLabel || '')
  .split(/\s*(?:->|→)\s*/)
  .filter(Boolean);

const ReviewRouteValue = ({ routeLabel }) => {
  const segments = splitRouteLabel(routeLabel);

  if (segments.length < 2) {
    return routeLabel || '--';
  }

  let routePrefix = '';
  const keyedSegments = segments.map((segment) => {
    routePrefix = routePrefix ? `${routePrefix}>${segment}` : segment;

    return {
      key: routePrefix,
      label: segment
    };
  });

  return (
    <span aria-label={routeLabel} className={styles.reviewRouteValue}>
      {keyedSegments.map((segment, index) => (
        <React.Fragment key={segment.key}>
          <span className={styles.reviewRouteSegment}>{segment.label}</span>
          {index < keyedSegments.length - 1 ? (
            <span className={styles.reviewRouteArrow}>
              <RouteArrowIcon />
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </span>
  );
};

const BridgeCard = ({ controller }) => {
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationSelectorOpen, setDestinationSelectorOpen] = useState(false);
  const [displayAddress, setDisplayAddress] = useState(() => formatAddressForInput(controller.address, false));
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isReceiveEstimateInfoOpen, setIsReceiveEstimateInfoOpen] = useState(false);
  const [isReviewTimeInfoOpen, setIsReviewTimeInfoOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const receiveEstimateInfoRef = useRef(null);
  const receiveEstimatePopoverIdRef = useRef(`receive-estimate-popover-${Math.random().toString(36).slice(2, 10)}`);
  const reviewTimeInfoRef = useRef(null);
  const reviewTimePopoverIdRef = useRef(`review-time-popover-${Math.random().toString(36).slice(2, 10)}`);

  const sourceCurrencies = useMemo(
    () => (
      Array.isArray(controller.sourceCurrencies)
        ? controller.sourceCurrencies
        : sortSourceCurrencies(controller.tokenOptions.map((token) => buildTokenCurrency(token)))
    ),
    [controller.sourceCurrencies, controller.tokenOptions]
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
    () => controller.receiveCurrency || (
      controller.selectedDestination ? buildDestinationCurrency(controller.selectedDestination, controller.selectedToken) : null
    ),
    [controller.receiveCurrency, controller.selectedDestination, controller.selectedToken]
  );

  useEffect(() => {
    setDisplayAddress(formatAddressForInput(controller.address, isAddressFocused));
  }, [controller.address, isAddressFocused]);

  useEffect(() => {
    if (!controller.isReviewing) {
      return;
    }

    setSourceSelectorOpen(false);
    setDestinationSelectorOpen(false);
  }, [controller.isReviewing]);

  useEffect(() => {
    if (controller.requiresReceiveQuote) {
      return;
    }

    setIsReceiveEstimateInfoOpen(false);
  }, [controller.requiresReceiveQuote]);

  useEffect(() => {
    if (controller.isReviewing) {
      return;
    }

    setIsReviewTimeInfoOpen(false);
  }, [controller.isReviewing]);

  useEffect(() => {
    if (!isReceiveEstimateInfoOpen && !isReviewTimeInfoOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (receiveEstimateInfoRef.current && !receiveEstimateInfoRef.current.contains(event.target)) {
        setIsReceiveEstimateInfoOpen(false);
      }

      if (reviewTimeInfoRef.current && !reviewTimeInfoRef.current.contains(event.target)) {
        setIsReviewTimeInfoOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsReceiveEstimateInfoOpen(false);
        setIsReviewTimeInfoOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isReceiveEstimateInfoOpen, isReviewTimeInfoOpen]);

  const receiveAmountDisplay = controller.receiveAmountDisplay ?? controller.estimatedDisplayValue;
  const receiveFiatLabel = controller.receiveFiatLabel ?? controller.estimatedFiatLabel;
  const reviewReceiveAmountDisplay = controller.reviewReceiveAmountDisplay || receiveAmountDisplay;
  const reviewReceiveFiatLabel = controller.reviewReceiveFiatLabel ?? receiveFiatLabel;
  const conversionWarningMessage = controller.conversionWarningMessage || '';
  const amountNumber = parseFloat(controller.amount);
  const hasPositiveAmount = !Number.isNaN(amountNumber) && amountNumber > 0;
  const isConversionReceiveEstimate = Boolean(controller.requiresReceiveQuote);
  const isAwaitingReceiveQuote = Boolean(controller.requiresReceiveQuote && !controller.hasFreshReceiveQuote);
  const shouldShowReceiveAmount = hasPositiveAmount && Boolean(receiveAmountDisplay) && receiveAmountDisplay !== '--';
  const showValidation = controller.address.length > 2;
  const isAddressValid = showValidation && !controller.addressError;
  const isAddressInvalid = showValidation && Boolean(controller.addressError);
  const showSelfButton = Boolean(controller.account && controller.allowsEthereumDestination !== false);
  const showBalance = controller.isWalletConnected && controller.tokenBalance;
  const isInsufficientBalance = Boolean(controller.amountError) && controller.amountError.includes('not available in your wallet');
  const showSendMeta = Boolean(controller.amountFiatLabel) || showBalance;
  const addressHint = controller.addressHint || 'Enter a Verus address (R-address or i-address) or Ethereum address';
  const addressPlaceholder = controller.addressPlaceholder || 'Enter receiving address';
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

  const showReceiveMeta = Boolean(receiveFiatLabel);
  const isReviewing = Boolean(controller.isReviewing);
  const sendSectionClassName = styles.cardSection;
  const receiveSectionClassName = [
    styles.cardSection,
    styles.cardSectionSecondary
  ]
    .filter(Boolean)
    .join(' ');
  const sendSelectorClassName = styles.selector;
  const receiveSelectorClassName = styles.selector;
  const reviewSendSectionClassName = [styles.cardSection, styles.reviewCardSection]
    .filter(Boolean)
    .join(' ');
  const reviewReceiveSectionClassName = [
    styles.cardSection,
    styles.cardSectionSecondary,
    styles.reviewCardSection
  ]
    .filter(Boolean)
    .join(' ');
  const sourceModalStatusMessage = !controller.isWalletConnected
    ? controller.sourceCatalogError || (controller.isSourceCatalogLoading ? 'Loading all currencies...' : '')
    : '';
  const sourceModalStatusTone = controller.sourceCatalogError ? 'warning' : 'info';
  const sourceModalStatusActionLabel = controller.sourceCatalogError ? 'Retry' : '';
  const formatReceiveAmount = (value) => {
    if (!isConversionReceiveEstimate || !value || value === '--' || /estimating/i.test(value)) {
      return value;
    }

    return value.startsWith('~') ? value : `~${value}`;
  };
  const liveReceiveAmountDisplay = formatReceiveAmount(receiveAmountDisplay);
  const reviewReceiveAmountText = formatReceiveAmount(reviewReceiveAmountDisplay);
  const receiveLabel = isConversionReceiveEstimate ? 'You receive (estimated)' : 'You receive';
  const receiveLabelHeader = (
    <div className={styles.selectorLabelRow}>
      <span className={styles.selectorLabel}>{receiveLabel}</span>
      {isConversionReceiveEstimate ? (
        <span className={styles.selectorLabelInfo} ref={receiveEstimateInfoRef}>
          <button
            aria-controls={isReceiveEstimateInfoOpen ? receiveEstimatePopoverIdRef.current : undefined}
            aria-expanded={isReceiveEstimateInfoOpen}
            aria-haspopup="dialog"
            aria-label="Show estimated receive details"
            className={styles.activityInfoButton}
            onClick={() => setIsReceiveEstimateInfoOpen((currentValue) => !currentValue)}
            type="button"
          >
            <InfoIcon />
          </button>

          {isReceiveEstimateInfoOpen ? (
            <div
              aria-label="Estimated receive details"
              className={`${styles.activityPopover} ${styles.selectorLabelPopover}`}
              id={receiveEstimatePopoverIdRef.current}
              role="dialog"
            >
              {RECEIVE_ESTIMATE_TOOLTIP_LINES.map((line) => (
                <div className={styles.activityPopoverLine} key={line}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </span>
      ) : null}
    </div>
  );
  const reviewTimeLabel = (
    <span className={styles.reviewDetailLabelRow}>
      <span className={styles.reviewDetailLabel}>Estimated time</span>
      <span className={styles.reviewDetailLabelInfo} ref={reviewTimeInfoRef}>
        <button
          aria-controls={isReviewTimeInfoOpen ? reviewTimePopoverIdRef.current : undefined}
          aria-expanded={isReviewTimeInfoOpen}
          aria-haspopup="dialog"
          aria-label="Show estimated time details"
          className={styles.activityInfoButton}
          onClick={() => setIsReviewTimeInfoOpen((currentValue) => !currentValue)}
          type="button"
        >
          <InfoIcon />
        </button>

        {isReviewTimeInfoOpen ? (
          <div
            aria-label="Estimated time details"
            className={`${styles.activityPopover} ${styles.reviewDetailPopover}`}
            id={reviewTimePopoverIdRef.current}
            role="dialog"
          >
            {REVIEW_TIME_TOOLTIP_LINES.map((line) => (
              <div className={styles.activityPopoverLine} key={line}>
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </span>
    </span>
  );

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

    if (isAwaitingReceiveQuote) {
      return {
        disabled: true,
        label: 'Estimating...'
      };
    }

    return {
      disabled: !controller.canSubmit || controller.isTxPending,
      label: controller.isTxPending ? 'Submitting...' : 'Review'
    };
  }, [
    controller.canSubmit,
    controller.hasFreshReceiveQuote,
    controller.isTxPending,
    controller.isWalletConnected,
    controller.requiresReceiveQuote,
    controller.selectedDestination,
    controller.selectedToken,
    hasPositiveAmount,
    isAwaitingReceiveQuote,
    isInsufficientBalance
  ]);

  return (
    <>
      {isReviewing ? (
        <div className={styles.reviewHeader}>
          <button
            className={styles.reviewBackButton}
            onClick={controller.closeReview}
            type="button"
          >
            <EditIcon />
            <span>Edit details</span>
          </button>
        </div>
      ) : null}

      <form
        className={styles.bridgeCard}
        id="bridge-interface"
        onSubmit={(event) => {
          event.preventDefault();

          if (isReviewing) {
            controller.handleSubmit();
            return;
          }

          if (controller.openReview) {
            controller.openReview();
            return;
          }

          controller.handleSubmit();
        }}
      >
        {controller.alert ? (
          <div className={styles.alert}>
            <Alert severity={controller.alert.severity}>{controller.alert.message}</Alert>
          </div>
        ) : null}

        {isReviewing ? (
          <>
            <div className={styles.bridgeCardInner}>
              <div className={reviewSendSectionClassName}>
                <div className={`${styles.selector} ${styles.reviewSelector}`}>
                  <div className={styles.selectorHeader}>
                    <span className={styles.selectorLabel}>You send</span>
                  </div>

                  <div className={`${styles.selectorRow} ${styles.reviewSummaryRow}`}>
                    <div className={styles.selectorInputWrap}>
                      <div className={styles.reviewSummaryText}>
                        <div className={styles.reviewAmountValue}>{controller.amount || '--'}</div>
                      </div>
                    </div>

                    <StaticCurrencyPill currency={selectedSourceCurrency} />
                  </div>

                  {controller.amountFiatLabel ? (
                    <div className={styles.reviewAmountMetaRow}>
                      <div className={styles.reviewAmountMeta}>{controller.amountFiatLabel}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={reviewReceiveSectionClassName}>
                <div className={`${styles.selector} ${styles.reviewSelector}`}>
                  <div className={styles.selectorHeader}>
                    {receiveLabelHeader}
                  </div>

                  <div className={`${styles.selectorRow} ${styles.reviewSummaryRow}`}>
                    <div className={styles.selectorInputWrap}>
                      <div className={styles.reviewSummaryText}>
                        <div className={styles.reviewAmountValue}>{reviewReceiveAmountText || '--'}</div>
                      </div>
                    </div>

                    <StaticCurrencyPill currency={selectedDestinationCurrency} />
                  </div>

                  {reviewReceiveFiatLabel ? (
                    <div className={styles.reviewAmountMetaRow}>
                      <div className={styles.reviewAmountMeta}>{reviewReceiveFiatLabel}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {conversionWarningMessage ? (
              <div className={styles.conversionWarningText} role="alert">
                <span className={styles.conversionWarningLabel}>High slippage warning:</span>
                {' '}
                <span>{conversionWarningMessage}</span>
              </div>
            ) : null}

            <div className={styles.reviewAddressPanel}>
              <div className={styles.reviewSectionLabel}>Destination address</div>
              <div className={styles.reviewAddressValue}>{controller.address}</div>
            </div>

            <div className={styles.reviewDetails}>
              <div className={styles.reviewDetailRow}>
                <span className={styles.reviewDetailLabel}>Route</span>
                <span className={styles.reviewDetailValue}>
                  <ReviewRouteValue routeLabel={controller.reviewRouteLabel} />
                </span>
              </div>

              <div className={styles.reviewDetailRow}>
                {reviewTimeLabel}
                <span className={styles.reviewDetailValue}>{controller.reviewTimeEstimate}</span>
              </div>

              {controller.reviewFeeRows?.map((row) => (
                <div className={styles.reviewDetailRow} key={row.id}>
                  <span className={styles.reviewDetailLabel}>{row.label}</span>
                  <span className={styles.reviewDetailValue}>
                    {row.fiatLabel ? <span className={styles.reviewDetailFiat}>{row.fiatLabel}</span> : null}
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <button
              className={`${styles.submitButton} ${!controller.canConfirmReview ? styles.submitButtonDisabled : ''}`}
              disabled={!controller.canConfirmReview}
              type="submit"
            >
              {controller.reviewConfirmLabel || 'Confirm'}
            </button>
          </>
        ) : (
          <>
            <div className={styles.bridgeCardInner}>
              <div className={sendSectionClassName}>
                <div className={sendSelectorClassName}>
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
                      className={`${styles.selectorButton} ${styles.selectorButtonSoft} ${selectedSourceCurrency ? styles.selectorButtonWithIcon : ''}`}
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

                  {showSendMeta ? (
                    <div className={styles.selectorMeta}>
                      {controller.amountFiatLabel ? (
                        <div className={styles.fiatValue}>{controller.amountFiatLabel}</div>
                      ) : null}

                      {showBalance ? (
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
                  ) : null}
                </div>
              </div>

              <div className={receiveSectionClassName}>
                <div className={receiveSelectorClassName}>
                  <div className={styles.selectorHeader}>
                    {receiveLabelHeader}
                  </div>

                  <div className={styles.selectorRow}>
                    <div className={styles.selectorInputWrap}>
                      <input
                        className={`${styles.amountInput} ${styles.amountInputDisabled}`}
                        disabled
                        placeholder="0.00"
                        type="text"
                        value={shouldShowReceiveAmount ? liveReceiveAmountDisplay : ''}
                      />
                    </div>

                    <button
                      className={`${styles.selectorButton} ${selectedDestinationCurrency ? styles.selectorButtonWithIcon : styles.selectorButtonPrimary}`}
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

                  {showReceiveMeta ? (
                    <div className={styles.receiveMeta}>
                      {receiveFiatLabel ? (
                        <div className={styles.fiatValue}>{receiveFiatLabel}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {conversionWarningMessage ? (
              <div className={styles.conversionWarningText} role="alert">
                <span className={styles.conversionWarningLabel}>High slippage warning:</span>
                {' '}
                <span>{conversionWarningMessage}</span>
              </div>
            ) : null}

            <div className={styles.addressBlock}>
              <div className={styles.addressHint}>{addressHint}</div>
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
                  placeholder={addressPlaceholder}
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
          </>
        )}
      </form>

      {!isReviewing ? (
        <>
          <CurrencyModal
            currencies={sourceCurrencies}
            emptyStateMessage={controller.isWalletConnected
              ? 'No matching assets found in this wallet.'
              : 'No currencies available yet.'}
            isLoading={controller.isWalletConnected && controller.isSourceCurrenciesLoading}
            isOpen={sourceSelectorOpen}
            loadingMessage="Loading wallet assets..."
            onClose={() => setSourceSelectorOpen(false)}
            onSelect={controller.selectToken}
            onStatusAction={controller.retrySourceCatalog}
            searchTerm={sourceSearch}
            setSearchTerm={setSourceSearch}
            statusActionLabel={sourceModalStatusActionLabel}
            statusMessage={sourceModalStatusMessage}
            statusTone={sourceModalStatusTone}
            title="Select a currency"
          />

          <CurrencyModal
            currencies={destinationCurrencies}
            emptyStateMessage={controller.destinationEmptyStateMessage || 'No currencies available yet. Enter a valid destination address to unlock receive options.'}
            isOpen={destinationSelectorOpen}
            onClose={() => setDestinationSelectorOpen(false)}
            onSelect={controller.selectDestination}
            searchTerm={destinationSearch}
            setSearchTerm={setDestinationSearch}
            title="Select a currency"
          />
        </>
      ) : null}
    </>
  );
};

export default BridgeCard;
