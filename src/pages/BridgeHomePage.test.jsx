import React from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  RouterProvider,
  createMemoryRouter,
  useLocation
} from 'react-router-dom';

import useBridgeController from 'hooks/useBridgeController';
import {
  ETHEREUM_NATIVE_ASSET_NAME,
  EXPECTED_ETHEREUM_CHAIN_ID,
  VERUS_NATIVE_ASSET_NAME
} from 'constants/contractAddress';
import {
  getSendScreenState,
  isSendRecordDismissed,
  resetSendScreenStateForTests,
  selectSendRecord
} from 'utils/sendScreenState';

import BridgeHomePage from './BridgeHomePage';

const createController = (overrides = {}) => ({
  baseBridgeFeeValue: 0,
  bounceBackFeeValue: 0,
  ethUsdPrice: 0,
  hasReviewSnapshot: false,
  isReviewing: false,
  notarizationLagBlocks: 0,
  notarizationLagSeconds: 0,
  verusChainHeight: 0,
  verusTipHeight: 0,
  ...overrides
});

vi.mock('components/BridgeCard', () => ({
  __esModule: true,
  default: () => <div data-testid="bridge-card" />
}));

vi.mock('components/ReferenceInfoBar', () => ({
  __esModule: true,
  default: () => <div data-testid="info-bar" />
}));

vi.mock('components/ReferenceTrustlessSection', () => ({
  __esModule: true,
  default: () => <section data-testid="trust-section" id="info" />
}));

vi.mock('components/SiteHeader', () => ({
  __esModule: true,
  default: () => <header data-testid="site-header" />
}));

vi.mock('components/SiteFooter', () => ({
  __esModule: true,
  default: () => <footer data-testid="site-footer" />
}));

vi.mock('hooks/useBridgeController', () => ({
  __esModule: true,
  default: vi.fn()
}));

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location-display">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const renderRoute = (initialEntries = ['/'], { strict = false } = {}) => {
  const router = createMemoryRouter(
    [{
      element: (
        <>
          <BridgeHomePage />
          <LocationProbe />
        </>
      ),
      path: '/'
    }],
    { initialEntries }
  );

  const tree = <RouterProvider router={router} />;

  return {
    router,
    ...render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree)
  };
};

describe('BridgeHomePage', () => {
  let capturedControllerOptions;
  let originalRequestAnimationFrame;
  let originalScrollIntoView;
  let scrollIntoViewSpy;

  beforeEach(() => {
    capturedControllerOptions = undefined;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    window.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 0;
    });
    if (!originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = () => {};
    }
    scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(vi.fn());

    resetSendScreenStateForTests();
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({
        hasReviewSnapshot: options.isReviewRequested,
        isReviewing: options.isReviewRequested
      });
    });
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    scrollIntoViewSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  test('renders the header outside the hero section so it can stay sticky across the page', () => {
    const { container } = render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    const page = container.firstElementChild;
    const header = screen.getByTestId('site-header');

    expect(page.firstElementChild).toBe(header);
    expect(header.parentElement).toBe(page);
  });

  test('introduces the bridge using the active network names', () => {
    render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Bridge assets to Verus' })).toBeInTheDocument();
    expect(screen.getByText(
      `Move assets between ${ETHEREUM_NATIVE_ASSET_NAME} and ${VERUS_NATIVE_ASSET_NAME} through the Verus-Ethereum Bridge.`
    )).toBeInTheDocument();
  });

  test('renders decorative tokens for the landing hero but not the review step', () => {
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({ hasReviewSnapshot: false, isReviewing: false });
    });

    const { rerender } = render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    const decor = screen.getByTestId('hero-token-decor');
    expect(decor).toHaveAttribute('aria-hidden', 'true');
    expect(decor.querySelectorAll('img')).toHaveLength(8);

    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({ hasReviewSnapshot: true, isReviewing: true });
    });

    rerender(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('hero-token-decor')).not.toBeInTheDocument();
  });

  test('hides the hero heading and trust section while the review step is open', () => {
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({ hasReviewSnapshot: true, isReviewing: true });
    });

    render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/bridge assets to Verus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/scroll to learn more/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('trust-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
  });

  test('pushes the canonical review URL when the page enter-review callback is used', async () => {
    const { router } = renderRoute();

    act(() => {
      capturedControllerOptions.enterReview();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=review');
    });

    expect(router.state.historyAction).toBe('PUSH');
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  test('replaces review mode with the home route when review auto-exits', async () => {
    const { router } = renderRoute(['/?step=review']);

    act(() => {
      capturedControllerOptions.exitReview();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/');
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('replaces review mode with the home route when edit details exits review', async () => {
    const { router } = renderRoute(['/?step=review']);

    act(() => {
      capturedControllerOptions.exitReview({ hash: '' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/');
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('normalizes an invalid review URL back to edit mode while preserving the info hash', async () => {
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({ hasReviewSnapshot: false, isReviewing: false });
    });

    const { router } = renderRoute(['/?step=review#info']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/#info');
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('scrolls to the info section when the route hash targets info', async () => {
    render(
      <MemoryRouter initialEntries={['/#info']}>
        <BridgeHomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled();
    });
  });

  test('re-runs the info scroll when edit mode becomes renderable on the same hash', async () => {
    let isReviewing = true;
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({
        hasReviewSnapshot: isReviewing,
        isReviewing
      });
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/#info']}>
        <BridgeHomePage />
      </MemoryRouter>
    );

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();

    isReviewing = false;

    rerender(
      <MemoryRouter initialEntries={['/#info']}>
        <BridgeHomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled();
    });
  });

  describe('send screens routing (plan S4)', () => {
    const record = (fields = {}) => ({
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      id: 'record-1',
      startedAt: 1,
      state: 'submitted',
      type: 'transfer',
      ...fields
    });

    // A controller whose send screen follows the module-level selection, as
    // the real controller does.
    const mockSendController = ({
      hasReviewSnapshot = false, isSendStoreReady = true, records = [], transitions = null
    } = {}) => {
      useBridgeController.mockImplementation((options = {}) => {
        capturedControllerOptions = options;
        const selected = getSendScreenState().selectedRecordId;
        return createController({
          getSendRecord: (id) => records.find((entry) => entry.id === id) || null,
          hasReviewSnapshot,
          hasSendScreen: Boolean(selected),
          isReviewing: false,
          isSendStoreReady,
          onSendTransition: transitions ? (listener) => {
            transitions.listener = listener;
            return () => {};
          } : undefined,
          selectSendRecord,
          sendFlowRecords: records
        });
      });
    };

    test('before the records store is ready, the route waits', async () => {
      mockSendController({ isSendStoreReady: false, records: [record()] });
      renderRoute(['/?step=review']);

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=review');
      expect(getSendScreenState().reopened).toBe(false);
    });

    test('a reload at ?step=review with an unresolved record opens the newest one at ?step=status', async () => {
      mockSendController({ records: [record({ id: 'old', startedAt: 1 }), record({ id: 'new', startedAt: 2 })] });
      const { router } = renderRoute(['/?step=review']);

      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status');
      });
      expect(router.state.historyAction).toBe('REPLACE');
      expect(getSendScreenState().selectedRecordId).toBe('new');
    });

    test('a reload at ?step=status reopens the screen also when effects run twice (StrictMode)', async () => {
      mockSendController({ records: [record({ id: 'restored' })] });
      renderRoute(['/?step=status'], { strict: true });

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status');
      expect(getSendScreenState().selectedRecordId).toBe('restored');
    });

    test('a resolved record does not reopen, and an empty status step goes to the form', async () => {
      mockSendController({ records: [record({ outcome: 'success', state: 'resolved' })] });
      renderRoute(['/?step=status']);

      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
      });
      expect(getSendScreenState().selectedRecordId).toBeNull();
    });

    test('a claim record or a record of another chain never opens the screen', async () => {
      mockSendController({ records: [record({ type: 'claim' }), record({ chainId: 5, id: 'other' })] });
      renderRoute(['/']);

      await waitFor(() => expect(getSendScreenState().reopened).toBe(true));
      expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
    });

    test('W1 replaces Review with the status step, and pushes it from the form', async () => {
      mockSendController({ hasReviewSnapshot: true });
      const { router } = renderRoute(['/?step=review']);

      act(() => {
        selectSendRecord('record-1');
        capturedControllerOptions.enterStatus();
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status'));
      expect(router.state.historyAction).toBe('REPLACE');

      act(() => {
        capturedControllerOptions.exitReview();
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/));
      act(() => {
        selectSendRecord('record-1');
        capturedControllerOptions.enterStatus();
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status'));
      expect(router.state.historyAction).toBe('PUSH');
    });

    test('Back from the status step hides that record from later results', async () => {
      const transitions = {};
      const resolved = record({ outcome: 'success', state: 'resolved' });
      mockSendController({ records: [resolved], transitions });
      const { router } = renderRoute(['/']);

      act(() => {
        selectSendRecord('record-1');
        capturedControllerOptions.enterStatus();
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status'));

      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/));
      expect(isSendRecordDismissed('record-1')).toBe(true);

      act(() => {
        transitions.listener({ outcome: 'success', recordId: 'record-1', to: 'resolved' });
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
    });

    test('a result that arrives on the form opens once; Review and rejections stay put', async () => {
      const transitions = {};
      const records = [
        record({ id: 'rejected', outcome: 'rejected', state: 'resolved' }),
        record({ id: 'done', outcome: 'reverted', state: 'resolved' })
      ];
      mockSendController({ records, transitions });
      const { router } = renderRoute(['/']);
      await waitFor(() => expect(transitions.listener).toBeTypeOf('function'));

      act(() => {
        transitions.listener({ outcome: 'rejected', recordId: 'rejected', to: 'resolved' });
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);

      act(() => {
        transitions.listener({ outcome: 'reverted', recordId: 'done', to: 'resolved' });
      });
      await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/?step=status'));
      expect(router.state.historyAction).toBe('PUSH');
      expect(getSendScreenState().selectedRecordId).toBe('done');
    });
  });
});

