import React from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { getSendScreen } from 'utils/sendScreens';

import SendStatusCard from './SendStatusCard';

// Screens come from the real screen model. Expected text comes from plan 3.2.
const HASH = `0x${'3f'.repeat(31)}1e`;
const METAMASK = { name: 'MetaMask', rdns: 'io.metamask' };
const NOW = 10_000_000;

const record = (fields = {}) => ({
  account: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
  chainId: 11155111,
  display: { destination: 'RDJZ59o6DA2Qwfg9kfUF5DLzvTyefBtAi7', receive: '~46.5 VRSCTEST', send: '0.005 ETH', timeEstimate: '1-6 hours' },
  id: 'record-1',
  path: 'E',
  request: { chainId: 11155111, data: '0x', to: '0x98f58684b05E7d40719E61955015aF91eF7e77d3', value: '0x0' },
  startedAt: NOW - 1000,
  state: 'awaiting-wallet',
  type: 'transfer',
  ...fields
});

const screenFor = (fields, flow = {}) => getSendScreen({
  documentRecordIds: new Set(['record-1']),
  flow,
  now: NOW,
  record: record(fields),
  wallet: METAMASK
});

const pending = () => screenFor({ hash: HASH, hashAt: NOW - 1000, state: 'submitted' });
const sent = () => screenFor({ hash: HASH, outcome: 'success', state: 'resolved' });

const renderCard = (props) => render(
  <MemoryRouter>
    <SendStatusCard onAction={vi.fn()} {...props} />
  </MemoryRouter>
);

describe('SendStatusCard', () => {
  test('puts only the title and the body in the live region and hides the mark', () => {
    const { container } = renderCard({ screen: sent() });
    const liveRegion = container.querySelector('[aria-live="polite"]');

    expect(within(liveRegion).getByRole('heading', { name: 'Sent' })).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent('0.005 ETH → ~46.5 VRSCTEST');
    expect(within(liveRegion).queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('section svg').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  test('a live result hides the swapped-out text from assistive technology', () => {
    const view = renderCard({ screen: pending() });

    view.rerender(
      <MemoryRouter>
        <SendStatusCard onAction={vi.fn()} screen={sent()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sent' })).toBeInTheDocument();
    expect(screen.getByText('Confirming…')).toHaveAttribute('aria-hidden', 'true');
  });

  test('a screen that opens while focus has nowhere to go focuses its title', () => {
    renderCard({ screen: pending() });

    expect(screen.getByRole('heading', { name: 'Confirming…' })).toHaveFocus();
  });

  test('a screen that opens while focus is elsewhere leaves focus alone', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    renderCard({ screen: sent() });

    expect(outside).toHaveFocus();
    outside.remove();
  });

  test('links the transaction to the explorer in a new tab', () => {
    renderCard({ screen: pending() });

    const link = screen.getByRole('link', { name: /view on etherscan/i });
    expect(link).toHaveAttribute('href', expect.stringMatching(new RegExp(`/tx/${HASH}$`)));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('"Clear after checking my wallet" asks first, and Cancel changes nothing', () => {
    const onAction = vi.fn();
    renderCard({ onAction, screen: screenFor({}) });

    const clear = screen.getByRole('button', { name: 'Clear after checking my wallet' });
    fireEvent.click(clear);

    const warning = screen.getByText('If the first transfer still goes through, you will bridge twice.');
    expect(warning).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Clear after checking my wallet' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Clear after checking my wallet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onAction).toHaveBeenCalledWith('clearRecord');
  });

  test('clearing is disabled when the records are read-only', () => {
    renderCard({ canMutateRecords: false, screen: screenFor({}) });

    expect(screen.getByRole('button', { name: 'Clear after checking my wallet' })).toBeDisabled();
  });

  test('"Check again" shows its spinner while it runs', () => {
    renderCard({ busyAction: 'checkAgain', screen: screenFor({}) });

    const button = screen.getByRole('button', { name: 'Check again' });
    expect(button).toBeDisabled();
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  test('"Copy details" copies the text, and shows it when the clipboard fails', async () => {
    const reverted = screenFor({ hash: HASH, outcome: 'reverted', state: 'resolved' });
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    const view = renderCard({ copyDetailsText: 'Wallet: MetaMask', screen: reverted });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy details' }));
    });

    expect(writeText).toHaveBeenCalledWith('Wallet: MetaMask');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    view.unmount();

    writeText.mockRejectedValue(new Error('denied'));
    renderCard({ copyDetailsText: 'Wallet: MetaMask', screen: reverted });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy details' }));
    });

    expect(screen.getByText('Wallet: MetaMask')).toBeInTheDocument();
    delete navigator.clipboard;
  });

  test('the wallet hint appears 15 s after W1 shows', () => {
    vi.useFakeTimers();
    try {
      const walletScreen = screenFor({}, { liveRequestRecordId: 'record-1' });
      renderCard({ screen: walletScreen });

      expect(screen.queryByText('MetaMask not showing? Open it from your browser toolbar.')).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(screen.getByText('MetaMask not showing? Open it from your browser toolbar.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
