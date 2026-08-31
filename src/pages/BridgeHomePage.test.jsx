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
  VERUS_NATIVE_ASSET_NAME
} from 'constants/contractAddress';

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

const renderRoute = (initialEntries = ['/']) => {
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

  return {
    router,
    ...render(<RouterProvider router={router} />)
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

  test('renders hero token decor only while the landing hero is visible', () => {
    useBridgeController.mockImplementation((options = {}) => {
      capturedControllerOptions = options;
      return createController({ hasReviewSnapshot: false, isReviewing: false });
    });

    const { rerender } = render(
      <MemoryRouter>
        <BridgeHomePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('hero-token-decor')).toBeInTheDocument();

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
});
