import React from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';
import {
  RouterProvider,
  createMemoryRouter,
  useLocation
} from 'react-router-dom';

import {
  REFUND_ADDRESS_STATUS_FAILED,
  requestAndCacheRefundAddressData,
  setRefundAddressSignatureStatus
} from 'utils/refundAddress';
import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY } from 'utils/walletConnection';

import SiteHeader from './SiteHeader';

jest.mock('@web3-react/core', () => {
  const createMockErrorType = (name) => {
    function MockError(message) {
      this.message = message;
      this.name = name;
    }

    MockError.prototype = Object.create(Error.prototype);
    MockError.prototype.constructor = MockError;

    return MockError;
  };

  return {
    UnsupportedChainIdError: createMockErrorType('UnsupportedChainIdError'),
    useWeb3React: jest.fn()
  };
});

jest.mock('@web3-react/injected-connector', () => {
  const createMockErrorType = (name) => {
    function MockError(message) {
      this.message = message;
      this.name = name;
    }

    MockError.prototype = Object.create(Error.prototype);
    MockError.prototype.constructor = MockError;

    return MockError;
  };

  return {
    NoEthereumProviderError: createMockErrorType('NoEthereumProviderError'),
    UserRejectedRequestError: createMockErrorType('UserRejectedRequestError')
  };
});

jest.mock('config/explorerLinks', () => ({
  getExplorerBaseUrl: () => 'https://etherscan.io'
}));

jest.mock('connectors/injectedConnector', () => ({
  injectedConnector: { id: 'injected' }
}));

jest.mock('utils/refundAddress', () => {
  const actual = jest.requireActual('utils/refundAddress');

  return {
    ...actual,
    requestAndCacheRefundAddressData: jest.fn()
  };
});

const mockAddToast = jest.fn();

jest.mock('./Toast/ToastProvider', () => ({
  useToast: () => ({ addToast: mockAddToast })
}));

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location-display">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const renderHeader = (initialEntries = ['/']) => {
  const router = createMemoryRouter(
    [{
      element: (
        <>
          <SiteHeader />
          <LocationProbe />
        </>
      ),
      path: '*'
    }],
    { initialEntries }
  );

  return {
    router,
    ...render(<RouterProvider router={router} />)
  };
};

describe('SiteHeader wallet interactions', () => {
  let offsetHeightGetter;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.scrollTo = jest.fn();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true
    });
    document.documentElement.style.removeProperty('--site-header-height');
    offsetHeightGetter = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function getOffsetHeight() {
      return this.tagName === 'HEADER' ? 72 : 0;
    });
  });

  afterEach(() => {
    offsetHeightGetter.mockRestore();
    document.documentElement.style.removeProperty('--site-header-height');
  });

  test('renders the updated primary navigation items', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    const navigation = screen.getByRole('navigation', { name: /primary/i });

    expect(within(navigation).getByRole('link', { name: 'Bridge' })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: 'Info' })).toHaveAttribute('href', '/#info');
    expect(within(navigation).queryByRole('link', { name: 'Transactions' })).toBeNull();
    expect(within(navigation).getByRole('link', { name: 'Refunds & earnings' })).toHaveAttribute('href', '/claim');
  });

  test('adds the scrolled header class after the page moves', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    const { container } = renderHeader();
    const header = container.querySelector('header');

    expect(header).not.toHaveClass('headerScrolled');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 80,
      writable: true
    });
    fireEvent.scroll(window);

    expect(header).toHaveClass('headerScrolled');
  });

  test('publishes the header height as a CSS variable for viewport layout', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    expect(document.documentElement.style.getPropertyValue('--site-header-height')).toBe('72px');
  });

  test('scrolls to the top when Bridge is clicked on the home route', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 320,
      writable: true
    });

    fireEvent.click(screen.getByRole('link', { name: 'Bridge' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  test('replaces the review route with edit mode when Bridge is clicked', async () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    const { router } = renderHeader(['/?step=review#bridge-interface']);

    fireEvent.click(screen.getByRole('link', { name: 'Bridge' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/');
    });

    expect(router.state.historyAction).toBe('REPLACE');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  test('matches Bridge behavior when the title link is clicked during review', async () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    const { router } = renderHeader(['/?step=review#bridge-interface']);

    fireEvent.click(screen.getByRole('link', { name: 'Verus-Ethereum Bridge' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/');
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('replaces the review route with the canonical info anchor when Info is clicked', async () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    const { router } = renderHeader(['/?step=review#bridge-interface']);

    fireEvent.click(screen.getByRole('link', { name: 'Info' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/#info');
    });

    expect(router.state.historyAction).toBe('REPLACE');
  });

  test('stores the disconnect preference before deactivating the wallet', () => {
    const deactivate = jest.fn();

    useWeb3React.mockReturnValue({
      account: '0x1234567890123456789012345678901234567890',
      activate: jest.fn(),
      deactivate,
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /0x1234/i }));
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBe('true');
  });

  test('shows a public key signing alert on the wallet button and retries from the menu', async () => {
    const account = '0x1234567890123456789012345678901234567890';

    requestAndCacheRefundAddressData.mockResolvedValue({
      publicKey: `0x04${'11'.repeat(64)}`,
      refundAddress: 'RPublicKeyAddress'
    });
    useWeb3React.mockReturnValue({
      account,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();
    act(() => {
      setRefundAddressSignatureStatus(account, REFUND_ADDRESS_STATUS_FAILED);
    });

    expect(await screen.findByRole('img', { name: /public key signature required/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /0x1234/i }));
    fireEvent.click(screen.getByRole('button', { name: /retry signing/i }));

    await waitFor(() => {
      expect(requestAndCacheRefundAddressData).toHaveBeenCalledWith(account);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      description: 'Public key signature confirmed.'
    });
  });

  test('shows only supported wallet choices in the header menu before connecting', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(screen.getByRole('button', { name: /metamask/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /walletconnect/i })).not.toBeInTheDocument();
  });

  test('clears the disconnect preference after a successful manual connect', async () => {
    const activate = jest.fn().mockResolvedValue(undefined);

    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /metamask/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /metamask/i })).not.toBeInTheDocument();
    });

    expect(activate).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBeNull();
  });

  test('closes the wallet menu when connector activation fails', async () => {
    const activate = jest.fn().mockRejectedValue(new Error('Connection rejected'));

    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /metamask/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /metamask/i })).not.toBeInTheDocument();
    });

    expect(activate).toHaveBeenCalledTimes(1);
  });
});
