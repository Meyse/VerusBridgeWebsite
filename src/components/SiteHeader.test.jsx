import React, { useEffect } from 'react';

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
  UserRejectedRequestError,
  getConnectorForWallet,
  resetConnectorsForTests
} from 'connectors/eip1193Connector';
import WalletProvider, { useWalletContext } from 'providers/WalletProvider';
import { announceWallet, createEip1193Provider } from 'testUtils/walletFixtures';
import {
  REFUND_ADDRESS_STATUS_FAILED,
  requestAndCacheRefundAddressData,
  setRefundAddressSignatureStatus
} from 'utils/refundAddress';
import { INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, REMEMBERED_WALLET_RDNS_KEY } from 'utils/walletConnection';
import { resetWalletDiscoveryForTests } from 'wallets/useWalletDiscovery';
import { resetWalletSessionForTests } from 'wallets/walletSession';

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

vi.mock('config/explorerLinks', () => ({
  getExplorerBaseUrl: () => 'https://etherscan.io'
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

// Sets the attempted wallet, as a failed eager connect does (plan D10).
const AttemptedWallet = ({ walletId }) => {
  const { setAttemptedWallet, wallets } = useWalletContext();

  useEffect(() => {
    const wallet = wallets.find((entry) => entry.id === walletId);
    if (wallet) {
      setAttemptedWallet(wallet);
    }
  }, [setAttemptedWallet, walletId, wallets]);

  return null;
};

const renderHeader = (initialEntries = ['/'], headerProps = {}, { attemptedWalletId } = {}) => {
  const router = createMemoryRouter(
    [{
      element: (
        <>
          <SiteHeader {...headerProps} />
          <LocationProbe />
          {attemptedWalletId ? <AttemptedWallet walletId={attemptedWalletId} /> : null}
        </>
      ),
      path: '*'
    }],
    { initialEntries }
  );
  const element = (
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  );
  const result = render(element);

  return {
    router,
    ...result,
    rerenderHeader: () => result.rerender(element)
  };
};

const installedWallets = [];

const installWallet = (name, rdns, uuid, provider = createEip1193Provider()) => {
  const entry = announceWallet({ name, provider, rdns, uuid });
  installedWallets.push(entry);
  return { ...entry.info, id: uuid, provider };
};

describe('SiteHeader wallet interactions', () => {
  let offsetHeightGetter;

  afterEach(() => {
    installedWallets.splice(0).forEach((entry) => entry.remove());
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetWalletDiscoveryForTests();
    resetConnectorsForTests();
    resetWalletSessionForTests();
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

    if (TESTNET) {
      expect(within(navigation).getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '/activity');
    } else {
      expect(within(navigation).queryByRole('link', { name: 'Activity' })).not.toBeInTheDocument();
    }
  });

  test('uses the abbreviated bridge name only for the compact title', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    const titleLink = screen.getByRole('link', { name: 'Verus-Ethereum Bridge' });

    expect(within(titleLink).getByText('Verus-Ethereum Bridge')).toHaveClass(styles.headerTitleFull);
    expect(within(titleLink).getByText('Verus-ETH Bridge')).toHaveClass(styles.headerTitleCompact);
    expect(within(titleLink).queryByText('Verus Bridge')).not.toBeInTheDocument();
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
      expect(testnetNotice.closest('header')).toBeNull();
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

    const mobileNavigation = screen.getByRole('navigation', { name: /mobile/i });

    expect(within(mobileNavigation).getByRole('link', { name: TEST_ALTERNATE_BRIDGE.label })).toHaveAttribute(
      'href',
      TESTNET ? 'https://mainnet.example/claim' : 'https://testnet.example/claim'
    );
    expect(within(mobileNavigation).queryByRole('link', { name: /nft bridge/i })).not.toBeInTheDocument();
  });

  test('exposes the mobile navigation state and toggles its accessible label', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();

    const openButton = screen.getByRole('button', { name: /open navigation/i });

    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();

    fireEvent.click(openButton);

    const closeButton = screen.getByRole('button', { name: /close navigation/i });

    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    expect(closeButton).toHaveAttribute('aria-controls', 'mobile-navigation');
    expect(screen.getByRole('navigation', { name: /mobile/i })).toBeInTheDocument();
  });

  test('closes the mobile navigation after a same-page Bridge selection', () => {
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader(['/']);

    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
    fireEvent.click(within(
      screen.getByRole('navigation', { name: /mobile/i })
    ).getByRole('link', { name: 'Bridge' }));

    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
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

  test('keeps a wrong-network action visible and switches the attempted wallet, not window.ethereum', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    const braveProvider = createEip1193Provider();
    const brave = installWallet('Brave Wallet', 'com.brave.wallet', 'brave-1', braveProvider);
    window.ethereum = { request: vi.fn() };
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
      error: new UnsupportedChainIdError('Unsupported chain')
    });

    renderHeader(['/'], {}, { attemptedWalletId: 'brave-1' });

    const networkAlert = screen.getByRole('alert');
    const switchButton = screen.getByRole('button', { name: `Switch to ${ETHEREUM_BLOCKCHAIN_NAME}` });
    const walletControls = networkAlert.parentElement;

    expect(networkAlert).toHaveTextContent(/wrong network/i);
    expect(walletControls).toHaveClass(styles.headerRight);
    expect(networkAlert).not.toContainElement(switchButton);
    expect(networkAlert.nextElementSibling).toContainElement(switchButton);
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();

    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(braveProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${EXPECTED_ETHEREUM_CHAIN_ID.toString(16)}` }]
      });
    });
    expect(window.ethereum.request).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledWith(getConnectorForWallet(brave), undefined, true);
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      description: `Brave Wallet switched to ${ETHEREUM_BLOCKCHAIN_NAME}.`
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
    const library = { send: vi.fn() };

    requestAndCacheRefundAddressData.mockResolvedValue({
      publicKey: `0x04${'11'.repeat(64)}`,
      refundAddress: 'RPublicKeyAddress'
    });
    useWeb3React.mockReturnValue({
      account,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null,
      library
    });

    renderHeader();
    act(() => {
      setRefundAddressSignatureStatus(account, REFUND_ADDRESS_STATUS_FAILED);
    });

    expect(await screen.findByRole('img', { name: /public key signature required/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /0x1234/i }));
    fireEvent.click(screen.getByRole('button', { name: /retry signing/i }));

    await waitFor(() => {
      expect(requestAndCacheRefundAddressData).toHaveBeenCalledWith(account, library);
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      description: 'Public key signature confirmed.'
    });
  });

  test('lists only MetaMask and Brave Wallet, in name order, with the supported-wallets line', () => {
    installWallet('MetaMask', 'io.metamask', 'metamask-1');
    installWallet('Coinbase Wallet', 'com.coinbase.wallet', 'coinbase-1');
    installWallet('Brave Wallet', 'com.brave.wallet', 'brave-1');
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    const menu = screen.getByLabelText('Wallet connection options');
    expect(within(menu).getAllByRole('button').map((button) => button.textContent)).toEqual(['Brave Wallet', 'MetaMask']);
    expect(within(menu).getByText('Works with MetaMask and Brave Wallet.')).toBeInTheDocument();
    expect(within(menu).queryByText(/coinbase/i)).not.toBeInTheDocument();
  });

  test('shows "No supported wallet found" after discovery settles, without naming other wallets', async () => {
    installWallet('Coinbase Wallet', 'com.coinbase.wallet', 'coinbase-1');
    useWeb3React.mockReturnValue({
      account: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByText('No supported wallet found', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('The bridge works with MetaMask and Brave Wallet. Install one of them, then reload this page.'))
      .toBeInTheDocument();
    expect(screen.queryByText(/coinbase/i)).not.toBeInTheDocument();
  });

  test('waits for the chosen wallet, and remembers it only after web3-react reports it active', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    const metaMask = installWallet('MetaMask', 'io.metamask', 'metamask-1');
    installWallet('Brave Wallet', 'com.brave.wallet', 'brave-1');
    window.localStorage.setItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY, 'true');
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
      error: null
    });

    const { rerenderHeader } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /^metamask$/i }));

    expect(activate).toHaveBeenCalledWith(getConnectorForWallet(metaMask));
    expect(await screen.findByText('Confirm in MetaMask')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /brave wallet/i })).toBeDisabled();
    expect(window.localStorage.getItem(REMEMBERED_WALLET_RDNS_KEY)).toBeNull();
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBe('true');

    useWeb3React.mockReturnValue({
      account: '0x1234567890123456789012345678901234567890',
      activate,
      active: true,
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      connector: getConnectorForWallet(metaMask),
      deactivate: vi.fn(),
      error: null
    });
    rerenderHeader();

    await waitFor(() => {
      expect(window.localStorage.getItem(REMEMBERED_WALLET_RDNS_KEY)).toBe('io.metamask');
    });
    expect(window.localStorage.getItem(INJECTED_WALLET_AUTO_CONNECT_DISABLED_KEY)).toBeNull();
    expect(screen.queryByText('Confirm in MetaMask')).not.toBeInTheDocument();
  });

  test('a rejected connection ends the waiting row and does not remember the wallet', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    installWallet('MetaMask', 'io.metamask', 'metamask-1');
    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
      error: null
    });

    const { rerenderHeader } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /^metamask$/i }));
    expect(await screen.findByText('Confirm in MetaMask')).toBeInTheDocument();

    useWeb3React.mockReturnValue({
      account: null,
      activate,
      deactivate: vi.fn(),
      error: new UserRejectedRequestError()
    });
    rerenderHeader();

    await waitFor(() => {
      expect(screen.queryByText('Confirm in MetaMask')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(REMEMBERED_WALLET_RDNS_KEY)).toBeNull();
    expect(mockAddToast).toHaveBeenCalledWith({ type: 'error', description: 'Wallet connection request rejected.' });
  });

  test('shows the connected wallet name in the menu', () => {
    const metaMask = installWallet('MetaMask', 'io.metamask', 'metamask-1');
    useWeb3React.mockReturnValue({
      account: '0x1234567890123456789012345678901234567890',
      activate: vi.fn(),
      active: true,
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      connector: getConnectorForWallet(metaMask),
      deactivate: vi.fn(),
      error: null
    });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /0x1234/i }));

    expect(screen.getByText('Connected with MetaMask')).toBeInTheDocument();
  });
});
