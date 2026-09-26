const app = require('./app.json');

module.exports = ({ config }) => {
  const expo = {
    ...app.expo,
    ...config,
    extra: {
      ...(app.expo.extra ?? {}),
      ...(config.extra ?? {}),
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '',
      mapboxStyleUrl: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/outdoors-v11',
    },
  };

  return { expo };
};
