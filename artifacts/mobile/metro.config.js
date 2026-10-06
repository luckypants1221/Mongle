const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const defaultResolver = config.resolver.resolveRequest;
const singletons = new Set(["react", "react-dom", "react-native", "expo", "expo-font"]);

// The workspace root has older Expo/React versions. Resolve these shared
// runtimes from the mobile app even when an import originates in the pnpm store.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const scopedContext = singletons.has(moduleName.split("/")[0])
    ? { ...context, originModulePath: path.join(__dirname, "package.json") }
    : context;
  return (defaultResolver ?? context.resolveRequest)(scopedContext, moduleName, platform);
};

module.exports = config;
