module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Le plugin transform-remove-console retire tous les `console.*` des bundles
  // de production (le hook env.production est activé par RN/metro en release).
  // Le plugin reanimated DOIT rester en dernier.
  env: {
    production: {
      plugins: [
        ['transform-remove-console', { exclude: ['error', 'warn'] }],
      ],
    },
  },
  plugins: [
    'react-native-reanimated/plugin',
  ],
};
