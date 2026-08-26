import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.join(projectRoot, 'src');
const sourceAliases = [
  'abis',
  'components',
  'config',
  'connectors',
  'constants',
  'hooks',
  'images',
  'pages',
  'providers',
  'styles',
  'utils'
];
const legacyEnvironmentKeys = [
  'REACT_APP_DELEGATOR_CONTRACT',
  'REACT_APP_RPC_URL_HOMESTEAD',
  'REACT_APP_RPC_URL_MAINNET',
  'REACT_APP_RPC_URL_SEPOLIA',
  'REACT_APP_TESTNET_ACTIVE',
  'REACT_APP_VERUS_END_BLOCK',
  'REACT_APP_VERUS_RPC_URL'
];

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, projectRoot, 'REACT_APP_');
  const processEnvironment = Object.fromEntries(
    legacyEnvironmentKeys.map((key) => [key, environment[key] || ''])
  );

  return {
    plugins: [react(), svgr()],
    resolve: {
      alias: Object.fromEntries(
        sourceAliases.map((directory) => [directory, path.join(sourceRoot, directory)])
      )
    },
    define: {
      'process.env': JSON.stringify(processEnvironment)
    },
    build: {
      outDir: 'build'
    },
    server: {
      host: 'localhost'
    },
    test: {
      environment: 'jsdom',
      globals: true,
      maxWorkers: 2,
      setupFiles: './src/setupTests.js'
    }
  };
});
