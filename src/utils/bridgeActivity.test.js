import {
  NOTARIZATION_CONFIRMED,
  NOTARIZATION_PENDING,
  TO_ETHEREUM,
  TO_VERUS,
  TRANSFER_KIND_CURRENCY_EXPORT,
  TRANSFER_KIND_VALUE,
  normalizeEthereumExports,
  normalizeNotarizations,
  normalizeVerusExports,
  sumTransfersByCurrency
} from './bridgeActivity';

// Hex and Base58 pairs come from the VRSCTEST chain and the Verus address tests.
const ETH_HEX = '0x67460C2f56774eD27EeB8685f29f6CEC0B090B00';
const ETH_IADDRESS = 'iCtawpxUiCc2sEupt7Z4u8SDAncGZpgSKm';
const BRIDGE_HEX = '0xffEce948b8A38bBcC813411D2597f7f8485a0689';
const BRIDGE_IADDRESS = 'iSojYsotVzXz4wh2eJriASGo6UidJDDhL2';
const VRSCTEST_HEX = '0xA6ef9ea235635E328124Ff3429dB9F9E91b64e2d';
const VRSCTEST_IADDRESS = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';
const KNEIPE_IADDRESS = 'iNZzqYdmfCPCcVSTBjbPT8Q7rqeFohxATu';
const IDENTITY_HASH = '0xf10eff5672c04791b4100d2ac120fd6c7e53a581';
const IDENTITY_ADDRESS = 'iRT8FM3UARr2Ey2rvektmy9rGUTT232dfT';
const ZERO_HEX = '0x0000000000000000000000000000000000000000';

describe('bridge activity data', () => {
  test('reads Sepolia exports as transfers with decoded Verus destinations and conversions', () => {
    const transfers = normalizeEthereumExports([
      {
        endHeight: 6858104,
        exportHash: '0xolder',
        transfers: [{
          amount: '300000000',
          currency: ETH_HEX,
          destCurrencyId: BRIDGE_HEX,
          destinationAddress: IDENTITY_HASH,
          destinationType: 4,
          flags: 1027,
          secondReserveId: VRSCTEST_HEX
        }]
      },
      {
        endHeight: 7866270,
        exportHash: '0xnewer',
        transfers: [
          {
            amount: '60000000',
            currency: ETH_HEX,
            destCurrencyId: BRIDGE_HEX,
            destinationAddress: `0x${'01'.repeat(20)}`,
            destinationType: 2,
            flags: 3,
            secondReserveId: ZERO_HEX
          },
          {
            amount: '100000000000',
            currency: VRSCTEST_HEX,
            destCurrencyId: BRIDGE_HEX,
            destinationAddress: IDENTITY_HASH,
            destinationType: 4 | 128,
            flags: 1,
            secondReserveId: ZERO_HEX
          }
        ]
      }
    ]);

    expect(transfers).toEqual([
      expect.objectContaining({
        amount: '0.6',
        currencyId: ETH_IADDRESS,
        destination: { address: 'R9NVxTj2ewfiTUzAfn7FSsq9kxNt6fjaaZ', kind: 'r-address' },
        direction: TO_VERUS,
        height: 7866270,
        receiveCurrencyId: BRIDGE_IADDRESS
      }),
      expect.objectContaining({
        amount: '1000',
        currencyId: VRSCTEST_IADDRESS,
        destination: { address: IDENTITY_ADDRESS, kind: 'identity' },
        height: 7866270,
        receiveCurrencyId: null
      }),
      expect.objectContaining({
        amount: '3',
        currencyId: ETH_IADDRESS,
        destination: { address: IDENTITY_ADDRESS, kind: 'identity' },
        height: 6858104,
        receiveCurrencyId: VRSCTEST_IADDRESS
      })
    ]);
  });

  test('reads Verus exports to Ethereum and separates currency definitions from value', () => {
    const transfers = normalizeVerusExports([
      {
        height: 217915,
        transfers: [{
          currencyvalues: { [KNEIPE_IADDRESS]: 0 },
          destination: { address: '0x0000000000000000000000000000000000000000', type: 70 },
          flags: 8257
        }],
        txid: 'a'.repeat(64),
        txoutnum: 0
      },
      {
        height: 1184969,
        transfers: [
          {
            currencyvalues: { [KNEIPE_IADDRESS]: 10 },
            destination: { address: '0x9e5fdc733eefcb6929a16dedf099bea26ae72057', type: 9 },
            flags: 65
          },
          {
            currencyvalues: { [ETH_IADDRESS]: 0.01 },
            destination: {
              address: '0x3b12dba482b3d7828f9d3cb91afc629eceffb71a',
              auxdests: [{ address: 'R9JpWJaFWkCqxgPpDA4KXCFc1XUBgbhiyD', type: 2 }],
              type: 73
            },
            flags: 65
          }
        ],
        txid: 'b'.repeat(64),
        txoutnum: 1
      }
    ]);

    expect(transfers).toEqual([
      expect.objectContaining({
        amount: '10',
        currencyId: KNEIPE_IADDRESS,
        destination: { address: '0x9e5fdc733eefcb6929a16dedf099bea26ae72057', kind: 'ethereum' },
        direction: TO_ETHEREUM,
        height: 1184969,
        kind: TRANSFER_KIND_VALUE,
        txid: 'b'.repeat(64)
      }),
      expect.objectContaining({
        amount: '0.01',
        currencyId: ETH_IADDRESS,
        destination: { address: '0x3b12dba482b3d7828f9d3cb91afc629eceffb71a', kind: 'ethereum' },
        kind: TRANSFER_KIND_VALUE
      }),
      expect.objectContaining({
        currencyId: KNEIPE_IADDRESS,
        height: 217915,
        kind: TRANSFER_KIND_CURRENCY_EXPORT
      })
    ]);
  });

  test('totals value transfers per currency without floating-point drift', () => {
    expect(sumTransfersByCurrency([
      { amount: '0.1', currencyId: ETH_IADDRESS, kind: TRANSFER_KIND_VALUE },
      { amount: '0.2', currencyId: ETH_IADDRESS, kind: TRANSFER_KIND_VALUE },
      { amount: '10', currencyId: KNEIPE_IADDRESS, kind: TRANSFER_KIND_VALUE },
      { amount: '0', currencyId: KNEIPE_IADDRESS, kind: TRANSFER_KIND_CURRENCY_EXPORT }
    ])).toEqual([
      { amount: '0.3', count: 2, currencyId: ETH_IADDRESS },
      { amount: '10', count: 1, currencyId: KNEIPE_IADDRESS }
    ]);
  });

  test('marks only the last confirmed notarization as confirmed and lists the newest first', () => {
    const notarizations = normalizeNotarizations({
      lastconfirmed: 0,
      notarizations: [
        { blockhash: 'hash-0', index: 0, notarization: { notarizationheight: 11567809 }, txid: 'tx-0', vout: 1 },
        { blockhash: 'hash-1', index: 1, notarization: { notarizationheight: 11605058 }, txid: 'tx-1', vout: 1 },
        { blockhash: 'hash-2', index: 2, notarization: { notarizationheight: 11604933 }, txid: 'tx-2', vout: 1 }
      ]
    });

    expect(notarizations.items.map((item) => [item.ethereumHeight, item.status])).toEqual([
      [11605058, NOTARIZATION_PENDING],
      [11604933, NOTARIZATION_PENDING],
      [11567809, NOTARIZATION_CONFIRMED]
    ]);
    expect(notarizations.pendingCount).toBe(2);
    expect(notarizations.lastConfirmed).toEqual(expect.objectContaining({
      ethereumHeight: 11567809,
      verusBlockHash: 'hash-0',
      verusTxid: 'tx-0'
    }));
  });
});
