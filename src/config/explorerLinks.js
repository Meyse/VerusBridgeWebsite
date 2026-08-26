import {
  DELEGATOR_ADD,
  GLOBAL_ADDRESS,
  TESTNET
} from 'constants/contractAddress';
import { isAddress } from 'utils/contract';

const ETHERSCAN_BASE_URL = TESTNET ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';

const buildAddressUrl = (address) => (isAddress(address) ? `${ETHERSCAN_BASE_URL}/address/${address}` : null);
const buildTokenUrl = (address) => (isAddress(address) ? `${ETHERSCAN_BASE_URL}/token/${address}` : null);

export const getExplorerResources = () => (
  [
    {
      id: 'contract',
      title: 'Bridge contract',
      description: 'Inspect the live delegator contract and transaction history.',
      href: buildAddressUrl(DELEGATOR_ADD)
    },
    {
      id: 'vrsc',
      title: 'VRSC token',
      description: 'Open the VRSC token contract on Ethereum.',
      href: buildTokenUrl(GLOBAL_ADDRESS.VRSC)
    },
    {
      id: 'bridge-veth',
      title: 'Bridge.vETH token',
      description: 'Open the Bridge.vETH contract on Ethereum.',
      href: buildTokenUrl(GLOBAL_ADDRESS.BETH)
    }
  ].filter((resource) => resource.href)
);

export const getExplorerBaseUrl = () => ETHERSCAN_BASE_URL;
