import { fromBase58Check } from './verusAddress';

export const convertVerusAddressToEthAddress = (verusAddress) => {
  const address = fromBase58Check(verusAddress).hash.toString('hex')
  return `0x${address}`
}
