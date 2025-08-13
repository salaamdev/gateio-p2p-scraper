// @ts-check
const eslint = require('@eslint/js');
const promise = require('eslint-plugin-promise');
const importPlugin = require('eslint-plugin-import');
const nodePlugin = require('eslint-plugin-n');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['old/**', 'data/**', 'logs/**', 'package-lock.json'] },
  eslint.configs.recommended,
  promise.configs['flat/recommended'],
  importPlugin.flatConfigs.recommended,
  nodePlugin.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['scraper/autoScroll.js', 'scraper/extract.js', 'scraper/stealth.js', 'scraper/scraper.js', 'test-*.js', 'debug-*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
      },
    },
    rules: {
      // these files contain code executed in the page context
      'no-undef': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    files: ['eslint.config.js'],
    rules: {
      'n/no-extraneous-require': 'off',
      'n/no-unpublished-require': 'off',
    },
  },
  {
    files: ['index.js'],
    rules: {
      'n/no-process-exit': 'off',
    },
  },
];
