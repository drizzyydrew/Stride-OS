const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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
