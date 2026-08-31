import { Contract, constants, utils } from 'ethers';

import { BN } from './ethereumUnits';
// returns the checksummed address if the address is valid, otherwise returns false
export function isAddress(value) {
  try {
    return utils.getAddress(value);
  } catch {
    return false;
  }
}


// account is not optional
export function getSigner(library, account) {
  return library.getSigner(account).connectUnchecked();
}

export function getProviderOrSigner(
  library,
  account
) {
  return account ? getSigner(library, account) : library;
}

// account is optional
export function getContract(
  address,
  ABI,
  library,
  account
) {
  if (!isAddress(address) || address === constants.AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`);
  }

  return new Contract(address, ABI, getProviderOrSigner(library, account));
}

export const getMaxAmount = async (ERCContract, account) => {
  const DAIBalanceInt = await ERCContract.balanceOf(account);
  const decimals = await ERCContract.decimals();
  const ten = new BN(10);
  const base = ten.pow(new BN(decimals));
  const DAIBalancewhole = parseFloat(DAIBalanceInt.div(base.toString()).toString());

  let mod = "";

  const tempRemainder = DAIBalanceInt.mod(base.toString()).toString();
  mod = tempRemainder;
  while (mod.length < decimals) {

    mod = "0" + mod;
  }
  const modulo = DAIBalancewhole + "." + mod;

  return parseFloat(modulo);
}
