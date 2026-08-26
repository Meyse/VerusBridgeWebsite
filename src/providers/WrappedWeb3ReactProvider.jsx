import React from 'react';

import { Web3ReactProvider } from '@web3-react/core';
import { providers } from 'ethers';

const getLibrary = (provider) => {
  const library = new providers.Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

const WrappedWeb3ReactProvider = ({ children }) => (
  <Web3ReactProvider getLibrary={getLibrary}>{children}</Web3ReactProvider>
);

export default WrappedWeb3ReactProvider;
