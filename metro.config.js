const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getSentryExpoConfig(__dirname, { includeWebReplay: false, enableSourceContextInDevelopment: false });

const ignoredArtifactDirs = [
  'strideos',
  'strideos 2',
  'strideos_Full_Project_LLM',
].map((dir) => path.resolve(__dirname, dir));

const artifactBlockList = ignoredArtifactDirs.map(
  (dir) => new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/.*$`),
);

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...artifactBlockList,
];

module.exports = config;
