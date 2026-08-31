import { useEffect, useState } from 'react';

import { useWeb3React } from '@web3-react/core';

import { injectedConnector } from '../connectors/injectedConnector';
import { isInjectedWalletAutoConnectSuppressed } from '../utils/walletConnection';

const useEagerConnect = () => {
  const { activate, active, setError } = useWeb3React();

  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (isInjectedWalletAutoConnectSuppressed()) {
      setTried(true);
      return undefined;
    }

    let stale = false;

    injectedConnector.isAuthorized().then((isAuthorized) => {
      if (stale) {
        return;
      }

      if (isAuthorized) {
        activate(injectedConnector, undefined, true).catch((activationError) => {
          if (!stale) {
            setError(activationError);
            setTried(true);
          }
        });
      } else {
        setTried(true);
      }
    });

    return () => {
      stale = true;
    };
  }, [activate, setError]); // intentionally only running on mount (make sure it's only mounted once :))

  // if the connection worked, wait until we get confirmation of that to flip the flag
  useEffect(() => {
    if (!tried && active) {
      setTried(true);
    }
  }, [tried, active]);

  return tried;
};

export default useEagerConnect;
