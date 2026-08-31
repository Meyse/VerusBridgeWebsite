import {
  assertBridgeTransactionContext,
  assertExpectedWalletChain,
  isExpectedWalletChain,
  normalizeChainId,
  requestExpectedWalletChain
} from './walletNetwork';

import {
  DELEGATOR_ADD,
  EXPECTED_ETHEREUM_CHAIN_ID
} from 'constants/contractAddress';

const expectedHexChainId = `0x${EXPECTED_ETHEREUM_CHAIN_ID.toString(16)}`;

describe('wallet transaction network checks', () => {
  test('normalizes decimal and hexadecimal chain identifiers', () => {
    expect(normalizeChainId(EXPECTED_ETHEREUM_CHAIN_ID)).toBe(EXPECTED_ETHEREUM_CHAIN_ID);
    expect(normalizeChainId(expectedHexChainId)).toBe(EXPECTED_ETHEREUM_CHAIN_ID);
    expect(normalizeChainId('not-a-chain')).toBeNull();
    expect(isExpectedWalletChain(expectedHexChainId)).toBe(true);
  });

  test('reads the live chain from the provider before continuing', async () => {
    const library = {
      send: vi.fn().mockResolvedValue(expectedHexChainId)
    };

    await expect(assertExpectedWalletChain(library)).resolves.toBe(EXPECTED_ETHEREUM_CHAIN_ID);
    expect(library.send).toHaveBeenCalledWith('eth_chainId', []);
  });

  test('rejects a live provider on a different chain', async () => {
    await expect(assertExpectedWalletChain({
      send: vi.fn().mockResolvedValue('0x5')
    })).rejects.toThrow(/Switch MetaMask/);
  });

  test('asks MetaMask to switch to the exact chain selected for this build', async () => {
    const provider = {
      request: vi.fn().mockResolvedValue(null)
    };

    await expect(requestExpectedWalletChain(provider)).resolves.toBe(EXPECTED_ETHEREUM_CHAIN_ID);
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expectedHexChainId }]
    });
  });

  test('fails clearly when no injected wallet can switch networks', async () => {
    await expect(requestExpectedWalletChain(null)).rejects.toThrow(/MetaMask is not available/);
  });

  test('requires deployed code at the configured bridge address', async () => {
    const library = {
      getCode: vi.fn().mockResolvedValue('0x'),
      send: vi.fn().mockResolvedValue(expectedHexChainId)
    };

    await expect(assertBridgeTransactionContext(library)).rejects.toThrow(/No bridge contract is deployed/);
    expect(library.getCode).toHaveBeenCalledWith(DELEGATOR_ADD);
  });

  test('accepts the configured bridge only on the expected chain with contract code', async () => {
    const library = {
      getCode: vi.fn().mockResolvedValue('0x60006000'),
      send: vi.fn().mockResolvedValue(expectedHexChainId)
    };

    await expect(assertBridgeTransactionContext(library)).resolves.toBe(DELEGATOR_ADD);
  });
});
