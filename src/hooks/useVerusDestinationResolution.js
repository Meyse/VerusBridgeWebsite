import { useEffect, useState } from 'react';

import {
  isVerusIdName,
  resolveVerusDestination
} from 'utils/verusDestination';

const EMPTY_RESOLUTION = {
  address: '',
  error: '',
  identityName: '',
  isResolving: false,
  requestKey: ''
};

const getResolutionMessage = ({ address, identityName, isResolving }) => {
  if (isResolving) {
    return 'Resolving VerusID…';
  }

  if (identityName && address) {
    return `${identityName} resolves to ${address}.`;
  }

  return '';
};

export const useVerusDestinationResolution = (
  value,
  rpc,
  networkName,
  delayMs = 180
) => {
  const input = typeof value === 'string' ? value.trim() : '';
  const isIdentity = isVerusIdName(input);
  const requestKey = isIdentity ? `${networkName}\u0000${input}` : '';
  const [resolution, setResolution] = useState(EMPTY_RESOLUTION);

  useEffect(() => {
    if (!isIdentity) {
      setResolution(EMPTY_RESOLUTION);
      return undefined;
    }

    let cancelled = false;
    setResolution({
      address: '',
      error: '',
      identityName: '',
      isResolving: true,
      requestKey
    });

    const timeoutId = setTimeout(async () => {
      try {
        const result = await resolveVerusDestination(input, rpc, networkName);

        if (!cancelled) {
          setResolution({
            address: result.address,
            error: '',
            identityName: result.identityName,
            isResolving: false,
            requestKey
          });
        }
      } catch (error) {
        if (!cancelled) {
          setResolution({
            address: '',
            error: error instanceof Error ? error.message : String(error),
            identityName: '',
            isResolving: false,
            requestKey
          });
        }
      }
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [delayMs, input, isIdentity, networkName, requestKey, rpc]);

  if (!isIdentity) {
    return {
      address: input,
      error: '',
      identityName: '',
      isIdentity: false,
      isResolving: false,
      message: ''
    };
  }

  const isCurrentResolution = resolution.requestKey === requestKey;
  const isResolving = !isCurrentResolution || resolution.isResolving;
  const address = isCurrentResolution ? resolution.address : '';
  const identityName = isCurrentResolution ? resolution.identityName : '';

  return {
    address,
    error: isCurrentResolution ? resolution.error : '',
    identityName,
    isIdentity: true,
    isResolving,
    message: getResolutionMessage({ address, identityName, isResolving })
  };
};
