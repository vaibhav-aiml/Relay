const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo (extend defaults, don't replace)
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Resolve packages in both project and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Fix monorepo hoisting: expo/AppEntry.js imports '../../App' which resolves
// to the monorepo root instead of apps/mobile. Redirect to expo-router/entry.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../../App' &&
    context.originModulePath &&
    context.originModulePath.includes(path.join('expo', 'AppEntry'))
  ) {
    return context.resolveRequest(context, 'expo-router/entry', platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
