import BigNumber from 'bignumber.js';

import { HEIGHT_LOCATION_IN_FORKS } from 'constants/contractAddress';
import { toBase58Check } from 'utils/verusAddress';

export const TO_VERUS = 'to-verus';
export const TO_ETHEREUM = 'to-ethereum';

export const TRANSFER_KIND_VALUE = 'value';
export const TRANSFER_KIND_CURRENCY_EXPORT = 'currency-export';

export const NOTARIZATION_CONFIRMED = 'confirmed';
export const NOTARIZATION_PENDING = 'pending';

const VERUS_AMOUNT_DECIMALS = 8;
const R_ADDRESS_VERSION = 60;
const IDENTITY_ADDRESS_VERSION = 102;
const DEST_PKH = 2;
const DEST_ID = 4;
const DEST_ETH = 9;
// Strips FLAG_DEST_AUX (64) and FLAG_DEST_GATEWAY (128) from a destination type.
const DESTINATION_TYPE_MASK = 0x3f;
const TRANSFER_FLAG_CONVERT = 0x2;
const TRANSFER_FLAG_RESERVE_TO_RESERVE = 0x400;
const TRANSFER_FLAG_CURRENCY_EXPORT = 0x2000;
const ZERO_HEX_ADDRESS = /^0x0{40}$/i;

const hasFlag = (flags, flag) => (Number(flags) & flag) === flag;

const byNewestHeight = (left, right) => right.height - left.height || left.order - right.order;

export const hexToIAddress = (hexAddress) => {
  if (typeof hexAddress !== 'string' || ZERO_HEX_ADDRESS.test(hexAddress)) {
    return null;
  }

  return toBase58Check(Buffer.from(hexAddress.replace(/^0x/i, ''), 'hex'), IDENTITY_ADDRESS_VERSION);
};

// The contract stores the Verus destination as a type plus a raw 20-byte hash.
export const decodeVerusDestination = (destinationType, hexAddress) => {
  const baseType = Number(destinationType) & DESTINATION_TYPE_MASK;
  const hash = Buffer.from((hexAddress || '').replace(/^0x/i, ''), 'hex');

  if (hash.length === 20 && baseType === DEST_PKH) {
    return { address: toBase58Check(hash, R_ADDRESS_VERSION), kind: 'r-address' };
  }

  if (hash.length === 20 && baseType === DEST_ID) {
    return { address: toBase58Check(hash, IDENTITY_ADDRESS_VERSION), kind: 'identity' };
  }

  return { address: null, kind: 'unknown' };
};

const getReceiveCurrencyId = (transfer) => {
  if (!hasFlag(transfer.flags, TRANSFER_FLAG_CONVERT)) {
    return null;
  }

  return hasFlag(transfer.flags, TRANSFER_FLAG_RESERVE_TO_RESERVE)
    ? hexToIAddress(transfer.secondReserveId)
    : hexToIAddress(transfer.destCurrencyId);
};

// Each Sepolia export batches the transfers sent in its end block.
export const normalizeEthereumExports = (exports = []) => exports
  .flatMap((exportBatch) => exportBatch.transfers.map((transfer, index) => ({
    amount: new BigNumber(transfer.amount).shiftedBy(-VERUS_AMOUNT_DECIMALS).toFixed(),
    currencyId: hexToIAddress(transfer.currency),
    destination: decodeVerusDestination(transfer.destinationType, transfer.destinationAddress),
    direction: TO_VERUS,
    height: Number(exportBatch.endHeight),
    id: `${exportBatch.exportHash}:${index}`,
    kind: TRANSFER_KIND_VALUE,
    order: index,
    receiveCurrencyId: getReceiveCurrencyId(transfer)
  })))
  .sort(byNewestHeight);

export const normalizeVerusExports = (exports = []) => exports
  .flatMap((exportBatch) => exportBatch.transfers.flatMap((transfer, index) => (
    Object.entries(transfer.currencyvalues || {}).map(([currencyId, amount]) => ({
      amount: new BigNumber(String(amount)).toFixed(),
      currencyId,
      destination: {
        address: transfer.destination?.address || null,
        kind: (Number(transfer.destination?.type) & DESTINATION_TYPE_MASK) === DEST_ETH ? 'ethereum' : 'unknown'
      },
      direction: TO_ETHEREUM,
      height: Number(exportBatch.height),
      id: `${exportBatch.txid}:${exportBatch.txoutnum}:${index}:${currencyId}`,
      // A currency export carries a currency definition, not value.
      kind: hasFlag(transfer.flags, TRANSFER_FLAG_CURRENCY_EXPORT)
        ? TRANSFER_KIND_CURRENCY_EXPORT
        : TRANSFER_KIND_VALUE,
      order: index,
      receiveCurrencyId: null,
      txid: exportBatch.txid
    }))
  )))
  .sort(byNewestHeight);

export const sumTransfersByCurrency = (transfers = []) => {
  const totals = new Map();

  transfers.forEach(({ amount, currencyId, kind }) => {
    if (kind !== TRANSFER_KIND_VALUE) {
      return;
    }

    const total = totals.get(currencyId) || { amount: new BigNumber(0), count: 0, currencyId };
    totals.set(currencyId, {
      ...total,
      amount: total.amount.plus(amount),
      count: total.count + 1
    });
  });

  return [...totals.values()]
    .sort((left, right) => right.count - left.count || left.currencyId.localeCompare(right.currencyId))
    .map((total) => ({ ...total, amount: total.amount.toFixed() }));
};

// getnotarizationdata returns the last confirmed notarization plus every
// notarization still waiting for confirmation.
export const normalizeNotarizations = (notarizationData) => {
  const lastConfirmedIndex = notarizationData?.lastconfirmed;
  const items = (notarizationData?.notarizations || [])
    .map((entry) => ({
      ethereumHeight: Number(entry.notarization?.notarizationheight),
      id: `${entry.txid}:${entry.vout}`,
      status: entry.index === lastConfirmedIndex ? NOTARIZATION_CONFIRMED : NOTARIZATION_PENDING,
      verusBlockHash: entry.blockhash,
      verusTxid: entry.txid
    }))
    .sort((left, right) => right.ethereumHeight - left.ethereumHeight);

  return {
    items,
    lastConfirmed: items.find((item) => item.status === NOTARIZATION_CONFIRMED) || null,
    pendingCount: items.filter((item) => item.status === NOTARIZATION_PENDING).length
  };
};

// Reads the Verus block height that the contract's best fork has confirmed.
export const parseNotarizationHeight = (forksData) => {
  if (typeof forksData !== 'string') {
    return 1;
  }

  const parsedHeight = Number(parseInt(`0x${forksData.substring(HEIGHT_LOCATION_IN_FORKS, HEIGHT_LOCATION_IN_FORKS + 8)}`, 16));
  return Number.isFinite(parsedHeight) && parsedHeight > 1 ? parsedHeight : 1;
};
