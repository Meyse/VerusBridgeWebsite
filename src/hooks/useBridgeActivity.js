import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  hexToIAddress,
  normalizeEthereumExports,
  normalizeNotarizations,
  normalizeVerusExports,
  parseNotarizationHeight,
  sumTransfersByCurrency
} from 'utils/bridgeActivity';
import { getCurrencyIcon, getTokenVerusSymbol } from 'utils/bridgeUi';

const SOURCE_LOADING = Object.freeze({ data: null, error: null, status: 'loading' });
const EMPTY_LIST = Object.freeze([]);

const formatShortId = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '');

const useSource = (load) => {
  const [state, setState] = useState(SOURCE_LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    setState(SOURCE_LOADING);

    load().then(
      (data) => {
        if (!ignore) {
          setState({ data, error: null, status: 'ready' });
        }
      },
      (error) => {
        if (!ignore) {
          setState({ data: null, error, status: 'error' });
        }
      }
    );

    return () => {
      ignore = true;
    };
  }, [attempt, load]);

  const retry = useCallback(() => setAttempt((currentAttempt) => currentAttempt + 1), []);

  return [state, retry];
};

// Loads each key once and keeps the result. A missing entry means the lookup
// is still running; null means the lookup failed or found nothing.
export const useLookup = (keys, load) => {
  const [values, setValues] = useState({});
  const requestedKeys = useRef(new Set());
  const isMounted = useRef(true);
  const keySignature = [...new Set(keys.filter((key) => key !== null && key !== undefined))].join('|');

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const missingKeys = (keySignature ? keySignature.split('|') : [])
      .filter((key) => !requestedKeys.current.has(key));

    missingKeys.forEach(async (key) => {
      requestedKeys.current.add(key);
      let value = null;

      try {
        value = await load(key);
      } catch {
        value = null;
      }

      if (isMounted.current) {
        setValues((currentValues) => ({ ...currentValues, [key]: value ?? null }));
      }
    });
  }, [keySignature, load]);

  return values;
};

const buildCurrencyCatalog = (tokens = []) => new Map(tokens.map((token) => {
  const tokenOption = { ...token, value: token.iaddress };
  return [hexToIAddress(token.iaddress), {
    icon: getCurrencyIcon(tokenOption),
    symbol: getTokenVerusSymbol(tokenOption)
  }];
}));

export default function useBridgeActivity(sources) {
  const [ethereum, retryEthereum] = useSource(sources.loadEthereumActivity);
  const [verus, retryVerus] = useSource(sources.loadVerusActivity);

  const currencyCatalog = useMemo(
    () => buildCurrencyCatalog(ethereum.data?.tokens),
    [ethereum.data]
  );
  const toVerusTransfers = useMemo(
    () => (ethereum.data ? normalizeEthereumExports(ethereum.data.exports) : EMPTY_LIST),
    [ethereum.data]
  );
  const toEthereumTransfers = useMemo(
    () => (verus.data ? normalizeVerusExports(verus.data.exports) : EMPTY_LIST),
    [verus.data]
  );
  const toVerusTotals = useMemo(() => sumTransfersByCurrency(toVerusTransfers), [toVerusTransfers]);
  const toEthereumTotals = useMemo(
    () => sumTransfersByCurrency(toEthereumTransfers),
    [toEthereumTransfers]
  );
  const notarizations = useMemo(
    () => (verus.data?.notarizationData ? normalizeNotarizations(verus.data.notarizationData) : null),
    [verus.data]
  );
  const confirmedVerusHeight = useMemo(() => {
    const height = parseNotarizationHeight(ethereum.data?.bestForks);
    return height > 1 ? height : null;
  }, [ethereum.data]);

  // The token list labels testnet tokens differently from Verus, so names
  // come from getcurrency and the token list only fills the gap meanwhile.
  const transferCurrencyIds = useMemo(() => [...toVerusTransfers, ...toEthereumTransfers]
    .flatMap((transfer) => [transfer.currencyId, transfer.receiveCurrencyId]), [toEthereumTransfers, toVerusTransfers]);
  const currencyNames = useLookup(transferCurrencyIds, sources.getVerusCurrencyName);

  const describeCurrency = useCallback((currencyId) => {
    const cataloguedCurrency = currencyCatalog.get(currencyId);
    const symbol = currencyNames[currencyId] || cataloguedCurrency?.symbol || formatShortId(currencyId);

    return {
      icon: cataloguedCurrency?.icon || getCurrencyIcon({ iaddress: currencyId, symbol }),
      symbol
    };
  }, [currencyCatalog, currencyNames]);

  const retry = useCallback(() => {
    if (ethereum.status === 'error') {
      retryEthereum();
    }

    if (verus.status === 'error') {
      retryVerus();
    }
  }, [ethereum.status, retryEthereum, retryVerus, verus.status]);

  return {
    confirmedVerusHeight,
    describeCurrency,
    ethereumStatus: ethereum.status,
    notarizations,
    retry,
    toEthereumTotals,
    toEthereumTransfers,
    toVerusTotals,
    toVerusTransfers,
    verusStatus: verus.status
  };
}
