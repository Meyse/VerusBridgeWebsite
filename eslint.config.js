import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['build/**', 'coverage/**', 'node_modules/**']
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      sourceType: 'module'
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'error'
    }
  }
];
