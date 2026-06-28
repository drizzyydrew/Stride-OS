const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withHealthKitAccessCleanup(config) {
  config = withEntitlementsPlist(config, (config) => {
    const access = config.modResults['com.apple.developer.healthkit.access'];
    if (Array.isArray(access) && access.length === 0) {
      delete config.modResults['com.apple.developer.healthkit.access'];
    }
    return config;
  });

  return withDangerousMod(config, [
    'ios',
    (config) => {
      const files = findEntitlementFiles(config.modRequest.platformProjectRoot);
      files.forEach((file) => {
        const source = fs.readFileSync(file, 'utf8');
        const next = source.replace(
          /\s*<key>com\.apple\.developer\.healthkit\.access<\/key>\s*<array>\s*<\/array>/g,
          '',
        );
        if (next !== source) {
          fs.writeFileSync(file, next);
        }
      });
      return config;
    },
  ]);
};

function findEntitlementFiles(root) {
  const files = [];
  const visit = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.entitlements')) {
        files.push(fullPath);
      }
    });
  };
  visit(root);
  return files;
}
