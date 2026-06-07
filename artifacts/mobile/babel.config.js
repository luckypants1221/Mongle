module.exports = function (api) {
  api.cache(true);

  return {
<<<<<<< HEAD
    presets: ['babel-preset-expo'],
    plugins: [require.resolve('expo-router/babel')],
=======
    presets: [["babel-preset-expo",]],
>>>>>>> 684c3ac87886160cf8e3234617b840d073ac2c1d
  };
};