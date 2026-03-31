const fs = require('fs');
const path = require('path');

const transpileModules = [
  '@noble/curves',
  '@noble/hashes',
  '@scure/bip32',
  '@scure/bip39',
  'ethereum-cryptography'
];

const resolvePackageRoot = (moduleName) => {
  let currentDir = path.dirname(require.resolve(moduleName));

  while (!fs.existsSync(path.join(currentDir, 'package.json'))) {
    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error(`Unable to find package root for ${moduleName}`);
    }

    currentDir = parentDir;
  }

  return currentDir;
};

const transpilePaths = transpileModules.map(resolvePackageRoot);

const toArray = (value) => (Array.isArray(value) ? value : [value].filter(Boolean));

module.exports = function override(config) {
  const oneOfRule = config.module.rules.find((rule) => Array.isArray(rule.oneOf));

  if (!oneOfRule) {
    return config;
  }

  const appBabelRule = oneOfRule.oneOf.find(
    (rule) => rule.loader && rule.loader.includes(`${path.sep}babel-loader${path.sep}`) && rule.include
  );

  if (!appBabelRule) {
    return config;
  }

  appBabelRule.include = [...toArray(appBabelRule.include), ...transpilePaths];

  return config;
};
