import { fromBase58Check } from './verusAddress';

const IDENTITY_ADDRESS_VERSION = 102;

const formatErrorDetail = (detail) => {
  const message = detail || 'The identity service returned no result.';
  return /[.!?]$/.test(message) ? message : `${message}.`;
};

const isCanonicalIdentityAddress = (address) => {
  try {
    return fromBase58Check(address).version === IDENTITY_ADDRESS_VERSION;
  } catch {
    return false;
  }
};

export const isVerusIdName = (value) => (
  typeof value === 'string' && value.trim().endsWith('@')
);

export const resolveVerusDestination = async (value, rpc, networkName) => {
  const input = typeof value === 'string' ? value.trim() : '';

  if (!isVerusIdName(input)) {
    return {
      address: input,
      identityName: '',
      input,
      isIdentity: false
    };
  }

  let response;

  try {
    response = await rpc.getIdentity(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to resolve this VerusID on ${networkName}. ${formatErrorDetail(detail)}`,
      { cause: error }
    );
  }

  const identityAddress = response?.result?.identity?.identityaddress;

  if (response?.error?.code === -5) {
    throw new Error(`VerusID not found on ${networkName}.`);
  }

  if (response?.error || !response?.result) {
    throw new Error(
      `Unable to resolve this VerusID on ${networkName}. ${formatErrorDetail(response?.error?.message)}`
    );
  }

  if (response.result.status !== 'active') {
    throw new Error(`This VerusID is not active on ${networkName}.`);
  }

  if (!isCanonicalIdentityAddress(identityAddress)) {
    throw new Error(`This VerusID did not resolve to a valid i-address on ${networkName}.`);
  }

  return {
    address: identityAddress,
    identityName: response.result.fullyqualifiedname || response.result.friendlyname || input,
    input,
    isIdentity: true
  };
};
