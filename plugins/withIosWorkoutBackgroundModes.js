const fs = require('fs');
const path = require('path');
const { withFinalizedMod, withInfoPlist } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const REQUIRED_BACKGROUND_MODES = ['audio', 'location'];

function addRequiredModes(plistObject) {
  const existing = Array.isArray(plistObject.UIBackgroundModes) ? plistObject.UIBackgroundModes : [];
  const modes = new Set(existing);
  for (const mode of REQUIRED_BACKGROUND_MODES) {
    modes.add(mode);
  }
  plistObject.UIBackgroundModes = Array.from(modes);
  return plistObject;
}

module.exports = function withIosWorkoutBackgroundModes(config) {
  config = withInfoPlist(config, (configWithPlist) => {
    addRequiredModes(configWithPlist.modResults);
    return configWithPlist;
  });

  return withFinalizedMod(config, ['ios', (configWithMod) => {
    const infoPlistPath = path.join(
      configWithMod.modRequest.platformProjectRoot,
      configWithMod.modRequest.projectName,
      'Info.plist',
    );
    const raw = fs.readFileSync(infoPlistPath, 'utf8');
    const parsed = plist.parse(raw);
    fs.writeFileSync(infoPlistPath, plist.build(addRequiredModes(parsed)));
    return configWithMod;
  }]);
};
