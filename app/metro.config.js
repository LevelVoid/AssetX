const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @anchor-lang/core's browser bundle keeps lazy `require("fs")` and `require("process")`
// calls for Node-only helpers. React Native has neither, so point them at a harmless
// shim and the browser process polyfill.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  fs: path.resolve(__dirname, "src/shims/empty.js"),
  process: require.resolve("process/browser.js"),
};

module.exports = config;
