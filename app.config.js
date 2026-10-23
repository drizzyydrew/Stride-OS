const app = require('./app.json');

module.exports = ({ config }) => {
  const expo = {
    ...app.expo,
    ...config,
    plugins: [
      ...(config.plugins ?? app.expo.plugins ?? []),
      'expo-localization',
      ['@sentry/react-native/expo', {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        url: 'https://sentry.io/',
      }],
    ],
    extra: {
      ...(app.expo.extra ?? {}),
      ...(config.extra ?? {}),
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '',
      mapboxStyleUrl: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/outdoors-v11',
    },
  };

  return { expo };
};
