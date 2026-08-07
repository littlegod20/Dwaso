const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// The monorepo root (two levels up from apps/mobile)
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo, not just apps/mobile.
//    This makes Metro notice changes in packages/shared-types.
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve modules from both the app's own node_modules
//    AND the root node_modules (where pnpm hoists shared deps).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
