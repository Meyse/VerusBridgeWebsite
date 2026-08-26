import { constants, utils } from 'ethers';

import {
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  EXPECTED_ETHEREUM_CHAIN_ID
} from 'constants/contractAddress';

const EMPTY_CODE = /^0x0*$/i;

export const normalizeChainId = (chainId) => {
  const normalized = typeof chainId === 'string' ? Number(chainId) : chainId;
  return Number.isSafeInteger(normalized) ? normalized : null;
};

export const isExpectedWalletChain = (chainId) => (
  normalizeChainId(chainId) === EXPECTED_ETHEREUM_CHAIN_ID
);

const getLiveChainId = async (library) => {
  if (!library) {
    throw new Error('Connect a wallet before submitting a transaction.');
  }

  if (typeof library.send === 'function') {
    return normalizeChainId(await library.send('eth_chainId', []));
  }

  if (typeof library.getNetwork === 'function') {
    const network = await library.getNetwork();
    return normalizeChainId(network?.chainId);
  }

  return null;
};

export const assertExpectedWalletChain = async (library) => {
  const chainId = await getLiveChainId(library);

  if (chainId !== EXPECTED_ETHEREUM_CHAIN_ID) {
    throw new Error(`Switch MetaMask to ${ETHEREUM_BLOCKCHAIN_NAME} before continuing.`);
  }

  return chainId;
};

export const assertBridgeTransactionContext = async (library) => {
  await assertExpectedWalletChain(library);

  let bridgeAddress;
  try {
    bridgeAddress = utils.getAddress(DELEGATOR_ADD);
  } catch {
    throw new Error('The bridge contract is not configured correctly for this build.');
  }

  if (bridgeAddress === constants.AddressZero || typeof library.getCode !== 'function') {
    throw new Error('The bridge contract is not configured correctly for this build.');
  }

  const code = await library.getCode(bridgeAddress);
  if (!code || EMPTY_CODE.test(code)) {
    throw new Error(`No bridge contract is deployed at ${bridgeAddress} on ${ETHEREUM_BLOCKCHAIN_NAME}.`);
  }

  return bridgeAddress;
};
