// Configuración de Babel.
// El plugin 'react-native-worklets/plugin' es necesario para que
// react-native-reanimated funcione (define worklets en JS y los traduce
// a la nativa). Sigue las instrucciones oficiales:
// https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};