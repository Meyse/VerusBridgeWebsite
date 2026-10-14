import { AbstractConnector } from '@web3-react/abstract-connector';
import { utils } from 'ethers';

import { EXPECTED_ETHEREUM_CHAIN_ID } from 'constants/contractAddress';
import { normalizeChainId } from 'utils/walletNetwork';
import { walletNameAtStart } from 'wallets/walletNames';

export class NoWalletError extends Error {
  constructor() {
    super('No supported wallet found in this browser.');
    this.name = 'NoWalletError';
  }
}

export class UserRejectedRequestError extends Error {
  constructor() {
    super('The user rejected the request.');
    this.name = 'UserRejectedRequestError';
  }
}

// Plan D4: a wallet that cannot report account or network changes cannot keep
// the session check (G3) current, so activation fails closed.
export class WalletEventsUnavailableError extends Error {
  constructor(wallet) {
    super(`${walletNameAtStart(wallet)} does not report account or network changes, so the bridge cannot use it.`);
    this.name = 'WalletEventsUnavailableError';
  }
}

const SUBSCRIBED_EVENTS = ['accountsChanged', 'chainChanged', 'disconnect'];

// One connector for one EIP-6963 wallet entry. It uses only the EIP-1193
// `request` method of the provider that the wallet announced (plan B2).
export class Eip1193Connector extends AbstractConnector {
  constructor({ provider, wallet }) {
    super({ supportedChainIds: [EXPECTED_ETHEREUM_CHAIN_ID] });

    this.provider = provider;
    this.wallet = wallet;
    this.subscriptions = [];
    this.handlers = {
      accountsChanged: this.handleAccountsChanged.bind(this),
      chainChanged: this.handleChainChanged.bind(this),
      disconnect: this.handleDisconnect.bind(this)
    };
  }

  handleAccountsChanged(accounts) {
    if (!Array.isArray(accounts) || accounts.length === 0) {
      this.emitDeactivate();
      return;
    }

    this.emitUpdate({ account: accounts[0] });
  }

  handleChainChanged(chainId) {
    this.emitUpdate({ chainId, provider: this.provider });
  }

  handleDisconnect() {
    this.emitDeactivate();
  }

  removeSubscriptions() {
    this.subscriptions.forEach(([event, handler]) => {
      try {
        this.provider.removeListener(event, handler);
      } catch (error) {
        // A wallet can block removeListener. The connector forgets the listener anyway.
      }
    });
    this.subscriptions = [];
  }

  // Idempotent: a second activate() must not add a second set of listeners.
  subscribe() {
    if (this.subscriptions.length === SUBSCRIBED_EVENTS.length) {
      return;
    }

    this.removeSubscriptions();

    try {
      SUBSCRIBED_EVENTS.forEach((event) => {
        const handler = this.handlers[event];
        this.provider.on(event, handler);
        this.subscriptions.push([event, handler]);
      });
    } catch (error) {
      this.removeSubscriptions();
      throw new WalletEventsUnavailableError(this.wallet);
    }
  }

  async activate() {
    let accounts;

    try {
      accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      if (error?.code === 4001) {
        throw new UserRejectedRequestError();
      }

      throw error;
    }

    if (!Array.isArray(accounts) || accounts.length === 0 || !utils.isAddress(accounts[0])) {
      throw new Error(`${walletNameAtStart(this.wallet)} did not return an account.`);
    }

    this.subscribe();

    return { account: accounts[0], provider: this.provider };
  }

  async getProvider() {
    return this.provider;
  }

  async getChainId() {
    const chainId = normalizeChainId(await this.provider.request({ method: 'eth_chainId' }));

    if (chainId === null) {
      throw new Error(`${walletNameAtStart(this.wallet)} returned an invalid network.`);
    }

    return chainId;
  }

  async getAccount() {
    const accounts = await this.provider.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) ? accounts[0] ?? null : null;
  }

  async isAuthorized() {
    try {
      const accounts = await this.provider.request({ method: 'eth_accounts' });
      return Array.isArray(accounts) && accounts.length > 0;
    } catch (error) {
      return false;
    }
  }

  deactivate() {
    this.removeSubscriptions();
  }
}

const connectorsByWalletId = new Map();

// One connector per wallet entry id (the announcement uuid), so web3-react sees
// the same connector object for the same wallet.
export const getConnectorForWallet = (wallet) => {
  if (!connectorsByWalletId.has(wallet.id)) {
    connectorsByWalletId.set(wallet.id, new Eip1193Connector({ provider: wallet.provider, wallet }));
  }

  return connectorsByWalletId.get(wallet.id);
};
