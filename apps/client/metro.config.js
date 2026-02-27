const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, "tools/scanner-core")
];
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@bookshelf/scanner-core": path.resolve(workspaceRoot, "tools/scanner-core/src")
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@babel/runtime": path.resolve(projectRoot, "node_modules/@babel/runtime"),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native")
};

module.exports = config;
