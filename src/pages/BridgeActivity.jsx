import React, { useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';
import { BRIDGE_DEPLOYMENT } from 'config/bridgeDeployment';
import {
  getEthereumAddressUrl,
  getEthereumBlockUrl,
  getVerusAddressUrl,
  getVerusTransactionUrl
} from 'config/explorerLinks';
import {
  BLOCKCHAIN_NAME,
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  GLOBAL_IADDRESS
} from 'constants/contractAddress';
import useBridgeActivity, { useLookup } from 'hooks/useBridgeActivity';
import {
  NOTARIZATION_CONFIRMED,
  TO_ETHEREUM,
  TO_VERUS,
  TRANSFER_KIND_CURRENCY_EXPORT
} from 'utils/bridgeActivity';
import { createBridgeActivitySources } from 'utils/bridgeActivitySources';
import { formatCompactAddress } from 'utils/bridgeUi';

import styles from '../styles/BridgeActivity.module.css';
import shellStyles from '../styles/ReferenceBridge.module.css';

const PAGE_SIZE = 10;
const NOTARIZATIONS_VIEW = 'notarizations';
const VIEW_IDS = [TO_VERUS, TO_ETHEREUM, NOTARIZATIONS_VIEW];
const EMPTY_KEYS = [];

const defaultSources = createBridgeActivitySources({
  delegatorAddress: DELEGATOR_ADD,
  ethereumChainId: BRIDGE_DEPLOYMENT.ethereumChainId,
  ethereumRpcUrl: BRIDGE_DEPLOYMENT.ethereumRpcUrl,
  verusRpcUrl: BRIDGE_DEPLOYMENT.verusRpcUrl,
  verusSystemId: GLOBAL_IADDRESS.ETH
});

const amountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const countFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

const formatAmount = (amount) => amountFormatter.format(amount);
const formatCount = (value) => countFormatter.format(value);
const formatDate = (timestamp) => dateFormatter.format(new Date(timestamp * 1000));
const formatDateTime = (timestamp) => dateTimeFormatter.format(new Date(timestamp * 1000));

const formatTimeAgo = (timestamp) => {
  const elapsedSeconds = Math.max(0, Date.now() / 1000 - timestamp);

  if (elapsedSeconds < 3600) {
    return relativeTimeFormatter.format(-Math.max(1, Math.round(elapsedSeconds / 60)), 'minute');
  }

  if (elapsedSeconds < 172800) {
    return relativeTimeFormatter.format(-Math.round(elapsedSeconds / 3600), 'hour');
  }

  return relativeTimeFormatter.format(-Math.round(elapsedSeconds / 86400), 'day');
};

const ExternalLinkIcon = () => (
  <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12">
    <path
      d="M14 4h6m0 0v6m0-6L10 14M20 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const ExternalLink = ({ children, className, href, label }) => {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a aria-label={label} className={className} href={href} rel="noreferrer" target="_blank">
      {children}
      <ExternalLinkIcon />
    </a>
  );
};

// Phones show the short text so a row's time and link fit on one line.
const ResponsiveText = ({ long, short }) => (
  <>
    <span className={styles.longText}>{long}</span>
    <span className={styles.shortText}>{short}</span>
  </>
);

const renderBlockTime = (timestamp) => (
  <ResponsiveText long={formatDateTime(timestamp)} short={formatDate(timestamp)} />
);

const Placeholder = ({ width = '6em' }) => (
  <span aria-hidden="true" className={styles.placeholder} style={{ width }} />
);

// A missing lookup value is still loading; null means it is unavailable.
const renderLookupValue = (value, render, width) => {
  if (value === undefined) {
    return <Placeholder width={width} />;
  }

  return value === null ? null : render(value);
};

// An undefined value is still loading; null means the value is unavailable.
const Fact = ({ detail, label, value }) => (
  <div className={styles.fact}>
    <dt className={styles.factLabel}>{label}</dt>
    <dd className={styles.factValue}>{value === undefined ? <Placeholder /> : value ?? '—'}</dd>
    {detail ? <dd className={styles.factDetail}>{detail}</dd> : null}
  </div>
);

const getMissingFactValue = (status) => {
  if (status === 'loading') {
    return undefined;
  }

  return status === 'ready' ? 'None' : null;
};

const SourceNotice = ({ chainName, onRetry, status }) => {
  if (status === 'loading') {
    return <p className={styles.panelStatus} role="status">Loading {chainName} data…</p>;
  }

  return (
    <div className={styles.notice} role="alert">
      <span>Couldn’t load {chainName} data.</span>
      <button className={styles.noticeAction} onClick={onRetry} type="button">
        Try again
      </button>
    </div>
  );
};

const ShowMoreButton = ({ onClick, remaining }) => (
  remaining > 0 ? (
    <button className={styles.showMore} onClick={onClick} type="button">
      Show {formatCount(Math.min(PAGE_SIZE, remaining))} more
    </button>
  ) : null
);

const TransferTotals = ({ describeCurrency, totals }) => (
  totals.length > 0 ? (
    <div className={styles.totals}>
      <h2 className={styles.totalsLabel}>Total sent</h2>
      <ul className={styles.totalsList}>
        {totals.map((total) => {
          const currency = describeCurrency(total.currencyId);

          return (
            <li className={styles.totalItem} key={total.currencyId}>
              <img alt="" className={styles.totalIcon} src={currency.icon} />
              <span className={styles.totalAmount}>{formatAmount(total.amount)}</span>
              <span className={styles.totalSymbol}>{currency.symbol}</span>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null
);

const getDestinationLink = (transfer, identityNames) => {
  const { address, kind } = transfer.destination;

  if (!address) {
    return { href: null, label: 'Unknown destination' };
  }

  if (kind === 'ethereum') {
    return { href: getEthereumAddressUrl(address), label: formatCompactAddress(address) };
  }

  const identityName = kind === 'identity' ? identityNames[address] : null;
  return { href: getVerusAddressUrl(address), label: identityName || formatCompactAddress(address) };
};

const TransferRow = ({ blockTimes, describeCurrency, identityNames, transfer }) => {
  const currency = describeCurrency(transfer.currencyId);
  const receiveCurrency = transfer.receiveCurrencyId ? describeCurrency(transfer.receiveCurrencyId) : null;
  const destination = getDestinationLink(transfer, identityNames);
  const isToVerus = transfer.direction === TO_VERUS;
  const sourceLabel = isToVerus
    ? `${ETHEREUM_BLOCKCHAIN_NAME} block ${formatCount(transfer.height)}`
    : `${BLOCKCHAIN_NAME} transaction`;
  const shortSourceLabel = isToVerus ? `Block ${formatCount(transfer.height)}` : 'Transaction';

  return (
    <li className={styles.row}>
      <img alt="" className={styles.rowIcon} src={currency.icon} />
      {transfer.kind === TRANSFER_KIND_CURRENCY_EXPORT ? (
        <div className={styles.rowMain}>
          <p className={styles.rowTitle}>{currency.symbol} definition</p>
          <p className={styles.rowDetail}>Currency exported to {ETHEREUM_BLOCKCHAIN_NAME}</p>
        </div>
      ) : (
        <div className={styles.rowMain}>
          <p className={styles.rowTitle}>
            {formatAmount(transfer.amount)} {currency.symbol}
            {receiveCurrency ? (
              <span className={styles.rowConversion} title={`Converted to ${receiveCurrency.symbol}`}>
                {' → '}{receiveCurrency.symbol}
              </span>
            ) : null}
          </p>
          <p className={styles.rowDetail}>
            To{' '}
            <ExternalLink className={styles.inlineLink} href={destination.href}>
              <span title={transfer.destination.address || undefined}>{destination.label}</span>
            </ExternalLink>
          </p>
        </div>
      )}
      <div className={styles.rowMeta}>
        <span className={styles.rowTime}>
          {renderLookupValue(blockTimes[transfer.height], renderBlockTime, '8em')}
        </span>
        <ExternalLink
          className={styles.metaLink}
          href={isToVerus ? getEthereumBlockUrl(transfer.height) : getVerusTransactionUrl(transfer.txid)}
          label={sourceLabel}
        >
          <ResponsiveText long={sourceLabel} short={shortSourceLabel} />
        </ExternalLink>
      </div>
    </li>
  );
};

const NotarizationRow = ({ blockTimes, notarization }) => {
  const isConfirmed = notarization.status === NOTARIZATION_CONFIRMED;

  return (
    <li className={`${styles.row} ${styles.rowNoIcon}`}>
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>
          {ETHEREUM_BLOCKCHAIN_NAME} block {formatCount(notarization.ethereumHeight)}
        </p>
        <p className={styles.rowDetail}>
          <span className={isConfirmed ? styles.statusConfirmed : styles.statusPending}>
            {isConfirmed ? 'Confirmed' : 'Pending'}
          </span>
        </p>
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.rowTime}>
          {renderLookupValue(blockTimes[notarization.verusBlockHash], renderBlockTime, '8em')}
        </span>
        <ExternalLink
          className={styles.metaLink}
          href={getVerusTransactionUrl(notarization.verusTxid)}
          label={`${BLOCKCHAIN_NAME} transaction`}
        >
          <ResponsiveText long={`${BLOCKCHAIN_NAME} transaction`} short="Transaction" />
        </ExternalLink>
      </div>
    </li>
  );
};

const BridgeActivity = ({ sources = defaultSources }) => {
  const activity = useBridgeActivity(sources);
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleCounts, setVisibleCounts] = useState({});
  const tabRefs = useRef({});

  const requestedView = searchParams.get('view');
  const activeView = VIEW_IDS.includes(requestedView) ? requestedView : TO_VERUS;
  const visibleCount = visibleCounts[activeView] || PAGE_SIZE;
  const notarizationItems = activity.notarizations?.items || EMPTY_KEYS;
  const latestNotarization = notarizationItems[0] || null;
  const lastConfirmedNotarization = activity.notarizations?.lastConfirmed || null;

  const views = [
    {
      count: activity.toVerusTransfers.length,
      id: TO_VERUS,
      label: `To ${BLOCKCHAIN_NAME}`,
      status: activity.ethereumStatus
    },
    {
      count: activity.toEthereumTransfers.length,
      id: TO_ETHEREUM,
      label: `To ${ETHEREUM_BLOCKCHAIN_NAME}`,
      status: activity.verusStatus
    },
    {
      count: notarizationItems.length,
      id: NOTARIZATIONS_VIEW,
      label: 'Notarizations',
      status: activity.verusStatus
    }
  ];

  const activeItems = {
    [NOTARIZATIONS_VIEW]: notarizationItems,
    [TO_ETHEREUM]: activity.toEthereumTransfers,
    [TO_VERUS]: activity.toVerusTransfers
  }[activeView];
  const visibleItems = activeItems.slice(0, visibleCount);

  const ethereumBlockTimes = useLookup(
    activeView === TO_VERUS ? visibleItems.map((transfer) => transfer.height) : EMPTY_KEYS,
    sources.getEthereumBlockTime
  );
  const verusBlockTimes = useLookup(
    [
      ...(activeView === TO_ETHEREUM ? visibleItems.map((transfer) => transfer.height) : EMPTY_KEYS),
      ...(activeView === NOTARIZATIONS_VIEW
        ? visibleItems.map((notarization) => notarization.verusBlockHash)
        : EMPTY_KEYS),
      latestNotarization?.verusBlockHash,
      activity.confirmedVerusHeight
    ],
    sources.getVerusBlockTime
  );
  const identityNames = useLookup(
    activeView === TO_VERUS
      ? visibleItems
        .filter((transfer) => transfer.destination.kind === 'identity')
        .map((transfer) => transfer.destination.address)
      : EMPTY_KEYS,
    sources.getVerusIdentityName
  );

  const selectView = (viewId) => {
    setSearchParams(viewId === TO_VERUS ? {} : { view: viewId }, { replace: true });
  };

  const handleTabKeyDown = (event) => {
    const currentIndex = VIEW_IDS.indexOf(activeView);
    const nextIndex = {
      ArrowLeft: (currentIndex + VIEW_IDS.length - 1) % VIEW_IDS.length,
      ArrowRight: (currentIndex + 1) % VIEW_IDS.length,
      End: VIEW_IDS.length - 1,
      Home: 0
    }[event.key];

    if (nextIndex === undefined) {
      return;
    }

    event.preventDefault();
    selectView(VIEW_IDS[nextIndex]);
    tabRefs.current[VIEW_IDS[nextIndex]]?.focus();
  };

  const showMore = () => {
    setVisibleCounts((currentCounts) => ({ ...currentCounts, [activeView]: visibleCount + PAGE_SIZE }));
  };

  const activeStatus = views.find((view) => view.id === activeView).status;
  const activeChainName = activeView === TO_VERUS ? ETHEREUM_BLOCKCHAIN_NAME : BLOCKCHAIN_NAME;
  const activeTotals = activeView === TO_VERUS
    ? activity.toVerusTotals
    : activeView === TO_ETHEREUM ? activity.toEthereumTotals : null;

  return (
    <div className={shellStyles.page}>
      <SiteHeader />

      <main className={styles.main}>
        <div className={styles.layout}>
          <header className={styles.intro}>
            <h1 className={styles.title}>Bridge activity</h1>
            <p className={styles.lead}>
              Read live from the {ETHEREUM_BLOCKCHAIN_NAME} bridge contract and the {BLOCKCHAIN_NAME} API.
            </p>
          </header>

          <dl className={styles.facts}>
            <Fact
              detail={latestNotarization
                ? `${ETHEREUM_BLOCKCHAIN_NAME} block ${formatCount(latestNotarization.ethereumHeight)}`
                : null}
              label={`Last notarization on ${BLOCKCHAIN_NAME}`}
              value={latestNotarization
                ? renderLookupValue(verusBlockTimes[latestNotarization.verusBlockHash], formatTimeAgo)
                : getMissingFactValue(activity.verusStatus)}
            />
            <Fact
              detail={activity.confirmedVerusHeight
                ? renderLookupValue(
                  verusBlockTimes[activity.confirmedVerusHeight],
                  (timestamp) => `${BLOCKCHAIN_NAME} block mined ${formatTimeAgo(timestamp)}`
                )
                : null}
              label={`${ETHEREUM_BLOCKCHAIN_NAME} confirmed through`}
              value={activity.confirmedVerusHeight
                ? `Block ${formatCount(activity.confirmedVerusHeight)}`
                : getMissingFactValue(activity.ethereumStatus)}
            />
            <Fact
              detail={lastConfirmedNotarization
                ? `Since ${ETHEREUM_BLOCKCHAIN_NAME} block ${formatCount(lastConfirmedNotarization.ethereumHeight)}`
                : null}
              label="Pending notarizations"
              value={activity.notarizations
                ? formatCount(activity.notarizations.pendingCount)
                : getMissingFactValue(activity.verusStatus)}
            />
          </dl>

          <section className={styles.history}>
            <div
              aria-label="Bridge history"
              className={styles.tabs}
              onKeyDown={handleTabKeyDown}
              role="tablist"
            >
              {views.map((view) => {
                const isActive = view.id === activeView;

                return (
                  <button
                    aria-controls={`activity-panel-${view.id}`}
                    aria-selected={isActive}
                    className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                    id={`activity-tab-${view.id}`}
                    key={view.id}
                    onClick={() => selectView(view.id)}
                    ref={(element) => {
                      tabRefs.current[view.id] = element;
                    }}
                    role="tab"
                    tabIndex={isActive ? 0 : -1}
                    type="button"
                  >
                    {view.label}
                    {view.status === 'ready' ? (
                      <>
                        {' '}
                        <span className={styles.tabCount}>{formatCount(view.count)}</span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              aria-labelledby={`activity-tab-${activeView}`}
              className={styles.panel}
              id={`activity-panel-${activeView}`}
              role="tabpanel"
            >
              {activeStatus !== 'ready' ? (
                <SourceNotice chainName={activeChainName} onRetry={activity.retry} status={activeStatus} />
              ) : null}

              {activeStatus === 'ready' && activeTotals ? (
                <TransferTotals describeCurrency={activity.describeCurrency} totals={activeTotals} />
              ) : null}

              {activeStatus === 'ready' && activeItems.length === 0 ? (
                <p className={styles.panelStatus}>
                  {activeView === NOTARIZATIONS_VIEW ? 'No notarizations to show.' : 'No transfers yet.'}
                </p>
              ) : null}

              {activeStatus === 'ready' && activeItems.length > 0 ? (
                <>
                  <ul className={styles.rows}>
                    {activeView === NOTARIZATIONS_VIEW
                      ? visibleItems.map((notarization) => (
                        <NotarizationRow
                          blockTimes={verusBlockTimes}
                          key={notarization.id}
                          notarization={notarization}
                        />
                      ))
                      : visibleItems.map((transfer) => (
                        <TransferRow
                          blockTimes={activeView === TO_VERUS ? ethereumBlockTimes : verusBlockTimes}
                          describeCurrency={activity.describeCurrency}
                          identityNames={identityNames}
                          key={transfer.id}
                          transfer={transfer}
                        />
                      ))}
                  </ul>
                  <ShowMoreButton onClick={showMore} remaining={activeItems.length - visibleItems.length} />
                </>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default BridgeActivity;
