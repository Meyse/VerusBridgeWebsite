import React from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryRouter,
  useLocation
} from 'react-router-dom';

import { useWeb3React } from '@web3-react/core';

import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY } from 'utils/walletConnection';

import SiteHeader from './SiteHeader';

jest.mock('@web3-react/core', () => ({
  UnsupportedChainIdError: class UnsupportedChainIdError extends Error {},
  useWeb3React: jest.fn()
}));

jest.mock('@web3-react/injected-connector', () => ({
  NoEthereumProviderError: class NoEthereumProviderError extends Error {},
  UserRejectedRequestError: class UserRejectedRequestError extends Error {}
}));

jest.mock('config/explorerLinks', () => ({
  getExplorerBaseUrl: () => 'https://etherscan.io'
}));

jest.mock('connectors/injectedConnector', () => ({
  injectedConnector: { id: 'injected' }
}));

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
    expect(within(navigation).getByRole('link', { name: 'Refunds & claims' })).toHaveAttribute('href', '/claim');
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

  test('shows clear wallet choices in the header menu before connecting', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: jest.fn(),
      deactivate: jest.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(screen.getByRole('button', { name: /metamask/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /walletconnect/i })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /walletconnect/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /walletconnect/i })).not.toBeInTheDocument();
    });

    expect(activate).toHaveBeenCalledTimes(1);
  });
});
