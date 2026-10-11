import React from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BLOCKCHAIN_NAME, ETHEREUM_BLOCKCHAIN_NAME } from 'constants/contractAddress';

import BridgeActivity from './BridgeActivity';

vi.mock('components/SiteHeader', () => ({
  __esModule: true,
  default: () => <header data-testid="site-header" />
}));

vi.mock('components/SiteFooter', () => ({
  __esModule: true,
  default: () => <footer data-testid="site-footer" />
}));

const ETH_HEX = '0x67460C2f56774eD27EeB8685f29f6CEC0B090B00';
const ETH_IADDRESS = 'iCtawpxUiCc2sEupt7Z4u8SDAncGZpgSKm';
const BRIDGE_HEX = '0xffEce948b8A38bBcC813411D2597f7f8485a0689';
const BRIDGE_IADDRESS = 'iSojYsotVzXz4wh2eJriASGo6UidJDDhL2';
const VRSCTEST_HEX = '0xA6ef9ea235635E328124Ff3429dB9F9E91b64e2d';
const VRSCTEST_IADDRESS = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';
const KNEIPE_IADDRESS = 'iNZzqYdmfCPCcVSTBjbPT8Q7rqeFohxATu';
const IDENTITY_HASH = '0xf10eff5672c04791b4100d2ac120fd6c7e53a581';
const ZERO_HEX = '0x0000000000000000000000000000000000000000';

const CURRENCY_NAMES = {
  [BRIDGE_IADDRESS]: 'Bridge.vETH',
  [ETH_IADDRESS]: 'vETH',
  [KNEIPE_IADDRESS]: 'kneipe',
  [VRSCTEST_IADDRESS]: 'VRSCTEST'
};

// The contract stores the confirmed Verus height as 8 hex digits at offset 130.
const createBestForks = (height) => `0x${'0'.repeat(128)}${height.toString(16).padStart(8, '0')}${'0'.repeat(64)}`;

const ethereumActivity = {
  bestForks: createBestForks(1185760),
  exports: [
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
      endHeight: 6858200,
      exportHash: '0xnewer',
      transfers: [{
        amount: '60000000',
        currency: ETH_HEX,
        destCurrencyId: BRIDGE_HEX,
        destinationAddress: `0x${'01'.repeat(20)}`,
        destinationType: 2,
        flags: 1,
        secondReserveId: ZERO_HEX
      }]
    }
  ],
  tokens: [{ erc20address: ZERO_HEX, flags: 37, iaddress: ETH_HEX, name: 'ETH (Testnet)', ticker: 'ETH' }]
};

const verusActivity = {
  exports: [
    {
      height: 217915,
      transfers: [{
        currencyvalues: { [KNEIPE_IADDRESS]: 0 },
        destination: { address: ZERO_HEX, type: 70 },
        flags: 8257
      }],
      txid: 'a'.repeat(64),
      txoutnum: 0
    },
    {
      height: 1184969,
      transfers: [{
        currencyvalues: { [KNEIPE_IADDRESS]: 10 },
        destination: { address: '0x9e5fdc733eefcb6929a16dedf099bea26ae72057', type: 9 },
        flags: 65
      }],
      txid: 'b'.repeat(64),
      txoutnum: 1
    }
  ],
  notarizationData: {
    lastconfirmed: 0,
    notarizations: Array.from({ length: 12 }, (_, index) => ({
      blockhash: `hash-${index}`,
      index,
      notarization: { notarizationheight: 11567809 + index * 100 },
      txid: `${index}`.padStart(64, '0'),
      vout: 1
    }))
  }
};

const createSources = (overrides = {}) => ({
  getEthereumBlockTime: vi.fn().mockResolvedValue(1788171693),
  getVerusBlockTime: vi.fn().mockResolvedValue(1788171693),
  getVerusCurrencyName: vi.fn(async (currencyId) => CURRENCY_NAMES[currencyId] || null),
  getVerusIdentityName: vi.fn().mockResolvedValue('dude.VRSCTEST@'),
  loadEthereumActivity: vi.fn().mockResolvedValue(ethereumActivity),
  loadVerusActivity: vi.fn().mockResolvedValue(verusActivity),
  ...overrides
});

const renderActivity = (sources, initialEntry = '/activity') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <BridgeActivity sources={sources} />
  </MemoryRouter>
);

describe('BridgeActivity', () => {
  test('lists transfers in both directions and notarizations with their status', async () => {
    renderActivity(createSources());

    const toVerusTab = await screen.findByRole('tab', { name: `To ${BLOCKCHAIN_NAME} 2` });
    expect(toVerusTab).toHaveAttribute('aria-selected', 'true');
    const toVerusPanel = screen.getByRole('tabpanel');
    await waitFor(() => {
      expect(toVerusPanel).toHaveTextContent('3 vETH → VRSCTEST');
      expect(toVerusPanel).toHaveTextContent('To dude.VRSCTEST@');
    });
    expect(toVerusPanel).toHaveTextContent('Total sent3.6vETH');
    expect(toVerusPanel).toHaveTextContent('0.6 vETH');
    expect(toVerusPanel).toHaveTextContent('To R9NVxT...jaaZ');
    expect(screen.getByText('Block 1,185,760')).toBeInTheDocument();
    expect(screen.getByText('Pending notarizations').nextElementSibling).toHaveTextContent(/^11$/);

    fireEvent.click(screen.getByRole('tab', { name: `To ${ETHEREUM_BLOCKCHAIN_NAME} 2` }));
    const toEthereumPanel = screen.getByRole('tabpanel');
    await waitFor(() => expect(toEthereumPanel).toHaveTextContent('10 kneipe'));
    expect(toEthereumPanel).toHaveTextContent('To 0x9e5f...2057');
    expect(toEthereumPanel).toHaveTextContent(`kneipe definitionCurrency exported to ${ETHEREUM_BLOCKCHAIN_NAME}`);

    fireEvent.click(screen.getByRole('tab', { name: 'Notarizations 12' }));
    const notarizationPanel = screen.getByRole('tabpanel');
    expect(within(notarizationPanel).getAllByText(new RegExp(`^(Pending|Confirmed on ${BLOCKCHAIN_NAME})$`))).toHaveLength(10);

    fireEvent.click(within(notarizationPanel).getByRole('button', { name: 'Show 2 more' }));
    expect(within(notarizationPanel).getAllByText(new RegExp(`^(Pending|Confirmed on ${BLOCKCHAIN_NAME})$`))).toHaveLength(12);
    expect(within(notarizationPanel).getAllByText(`Confirmed on ${BLOCKCHAIN_NAME}`)).toHaveLength(1);
  });

  test('keeps the loaded chain visible when the other fails and retries only the failed source', async () => {
    const sources = createSources({
      loadVerusActivity: vi.fn()
        .mockRejectedValueOnce(new Error('Network error 503'))
        .mockResolvedValueOnce(verusActivity)
    });
    renderActivity(sources, '/activity?view=to-ethereum');

    expect(await screen.findByRole('alert')).toHaveTextContent(`Couldn’t load ${BLOCKCHAIN_NAME} data.`);
    expect(screen.getByRole('tab', { name: `To ${ETHEREUM_BLOCKCHAIN_NAME}` })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('tab', { name: `To ${BLOCKCHAIN_NAME} 2` })).toBeInTheDocument();
    expect(screen.getByText('Pending notarizations').nextElementSibling).toHaveTextContent(/^—$/);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('tabpanel')).toHaveTextContent('10 kneipe'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(sources.loadVerusActivity).toHaveBeenCalledTimes(2);
    expect(sources.loadEthereumActivity).toHaveBeenCalledTimes(1);
  });
});
