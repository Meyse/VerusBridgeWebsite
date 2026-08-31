import React from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import {
  RouterProvider,
  createMemoryRouter,
  useLocation
} from 'react-router-dom';

import {
  ETHEREUM_BLOCKCHAIN_NAME,
  EXPECTED_ETHEREUM_CHAIN_ID,
  TESTNET
} from 'constants/contractAddress';
import {
  REFUND_ADDRESS_STATUS_FAILED,
  requestAndCacheRefundAddressData,
  setRefundAddressSignatureStatus
} from 'utils/refundAddress';
import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY } from 'utils/walletConnection';

import SiteHeader from './SiteHeader';
import styles from '../styles/ReferenceBridge.module.css';

vi.mock('@web3-react/core', () => {
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
    useWeb3React: vi.fn()
  };
});

vi.mock('@web3-react/injected-connector', () => {
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

vi.mock('config/explorerLinks', () => ({
  getExplorerBaseUrl: () => 'https://etherscan.io'
}));

vi.mock('connectors/injectedConnector', () => ({
  injectedConnector: { id: 'injected' }
}));

vi.mock('utils/refundAddress', async () => {
  const actual = await vi.importActual('utils/refundAddress');

  return {
    ...actual,
    requestAndCacheRefundAddressData: vi.fn()
  };
});

const mockAddToast = vi.fn();

vi.mock('./Toast/ToastProvider', () => ({
  useToast: () => ({ addToast: mockAddToast })
}));

const LocationProbe = () => {
  const location = useLocation();

  return <div data-testid="location-display">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const TEST_ALTERNATE_BRIDGE = {
  label: TESTNET ? 'Switch to Mainnet' : 'Switch to Testnet',
  origin: TESTNET ? 'https://mainnet.example/' : 'https://testnet.example/',
  target: TESTNET ? 'Mainnet' : 'Testnet'
};

const renderHeader = (initialEntries = ['/'], headerProps = {}) => {
  const router = createMemoryRouter(
    [{
      element: (
        <>
          <SiteHeader {...headerProps} />
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
    vi.clearAllMocks();
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: undefined,
      writable: true
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true
    });
    document.documentElement.style.removeProperty('--site-header-height');
    offsetHeightGetter = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function getOffsetHeight() {
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
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    const navigation = screen.getByRole('navigation', { name: /primary/i });

    expect(within(navigation).getByRole('link', { name: 'Bridge' })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: 'Info' })).toHaveAttribute('href', '/#info');
    expect(within(navigation).queryByRole('link', { name: 'Transactions' })).toBeNull();
    const claimLabel = TESTNET ? 'Refunds' : 'Refunds & earnings';

    expect(within(navigation).getByRole('link', { name: claimLabel })).toHaveAttribute('href', '/claim');
    expect(within(navigation).queryByRole('link', {
      name: TESTNET ? 'Refunds & earnings' : 'Refunds'
    })).not.toBeInTheDocument();
  });

  test('shows the persistent testnet boundary only for the testnet build', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    const testnetNotice = screen.queryByRole('status', { name: /testnet environment/i });
    if (TESTNET) {
      expect(testnetNotice).toHaveTextContent(
        'TESTNETSepolia ↔ VRSCTEST · Test assets have no real-world value'
      );
    } else {
      expect(testnetNotice).not.toBeInTheDocument();
    }
  });

  test('keeps the deployment switch beside the wallet controls without carrying transaction state', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader(['/claim?step=review#bridge-interface'], {
      alternateBridge: TEST_ALTERNATE_BRIDGE
    });

    const navigation = screen.getByRole('navigation', { name: /primary/i });
    const switchLink = screen.getByRole('link', { name: TEST_ALTERNATE_BRIDGE.label });
    const connectButton = screen.getByRole('button', { name: /connect wallet/i });

    expect(within(navigation).queryByRole('link', { name: TEST_ALTERNATE_BRIDGE.label })).not.toBeInTheDocument();
    expect(switchLink).toHaveAttribute(
      'href',
      TESTNET ? 'https://mainnet.example/claim' : 'https://testnet.example/claim'
    );
    expect(switchLink.compareDocumentPosition(connectButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));

    expect(screen.getAllByRole('link', { name: TEST_ALTERNATE_BRIDGE.label })).toHaveLength(1);
  });

  test('omits the deployment switch when no counterpart site is configured', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader(['/'], { alternateBridge: null });

    expect(screen.queryByRole('link', { name: /switch to (mainnet|testnet)/i })).not.toBeInTheDocument();
  });

  test('keeps a wrong-network action visible and switches MetaMask before reconnecting', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue(null);

    window.ethereum = { request };
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
      error: new UnsupportedChainIdError('Unsupported chain')
    });

    renderHeader();

    const networkAlert = screen.getByRole('alert');
    const switchButton = screen.getByRole('button', { name: `Switch to ${ETHEREUM_BLOCKCHAIN_NAME}` });
    const walletControls = networkAlert.parentElement;

    expect(networkAlert).toHaveTextContent(/wrong network/i);
    expect(walletControls).toHaveClass(styles.headerRight);
    expect(networkAlert).not.toContainElement(switchButton);
    expect(networkAlert.nextElementSibling).toContainElement(switchButton);
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
    expect(mockAddToast).not.toHaveBeenCalledWith({
      type: 'error',
      description: `Switch MetaMask to ${ETHEREUM_BLOCKCHAIN_NAME}.`
    });

    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${EXPECTED_ETHEREUM_CHAIN_ID.toString(16)}` }]
      });
    });
    expect(activate).toHaveBeenCalledWith({ id: 'injected' }, undefined, true);
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      description: `MetaMask switched to ${ETHEREUM_BLOCKCHAIN_NAME}.`
    });
  });

  test('adds the scrolled header class after the page moves', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
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

    expect(header.className).toMatch(/headerScrolled/);
  });

  test('publishes the header height as a CSS variable for viewport layout', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    expect(document.documentElement.style.getPropertyValue('--site-header-height')).toBe('72px');
  });

  test('scrolls to the top when Bridge is clicked on the home route', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
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
      activate: vi.fn(),
      deactivate: vi.fn(),
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
      activate: vi.fn(),
      deactivate: vi.fn(),
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
      activate: vi.fn(),
      deactivate: vi.fn(),
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
    const deactivate = vi.fn();
    useWeb3React.mockReturnValue({
      account: '0x1234567890123456789012345678901234567890',
      activate: vi.fn(),
      deactivate,
      error: null
    });

    renderHeader(['/'], { alternateBridge: TEST_ALTERNATE_BRIDGE });

    const switchLink = screen.getByRole('link', { name: TEST_ALTERNATE_BRIDGE.label });
    const connectedWalletButton = screen.getByRole('button', { name: /0x1234/i });

    expect(switchLink.compareDocumentPosition(connectedWalletButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(connectedWalletButton);
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
      activate: vi.fn(),
      deactivate: vi.fn(),
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
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(screen.getByRole('button', { name: /metamask/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /walletconnect/i })).not.toBeInTheDocument();
  });

  test('clears the disconnect preference after a successful manual connect', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);

    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
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
    const activate = vi.fn().mockRejectedValue(new Error('Connection rejected'));

    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
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
