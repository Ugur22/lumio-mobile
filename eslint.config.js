// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The resolver cannot read these packages' nested `exports` maps; tsc still resolves and checks them.
    rules: { 'import/no-unresolved': ['error', { ignore: ['^expo-'] }] },
  },
]);
