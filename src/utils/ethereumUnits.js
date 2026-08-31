import BN from 'bn.js';
import { utils } from 'ethers';

const assertEtherUnit = (unit) => {
  if (unit !== undefined && unit !== 'ether') {
    throw new TypeError(`Unsupported Ethereum unit: ${unit}`);
  }
};

export { BN };

export const fromWei = (value, unit) => {
  assertEtherUnit(unit);
  return utils.formatEther(value.toString());
};

export const toBN = (value) => BN.isBN(value) ? value : new BN(value.toString(), 10);

export const toWei = (value, unit) => {
  assertEtherUnit(unit);
  return utils.parseEther(value.toString()).toString();
};

export const padLeft = (value, length) => value.toString().padStart(length, '0');
