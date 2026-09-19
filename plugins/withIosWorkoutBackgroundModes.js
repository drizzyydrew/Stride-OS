const fs = require('fs');
const path = require('path');
const { withFinalizedMod, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
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

function syncNativeTargetBuildNumbers(project, buildNumber) {
  if (!buildNumber) return;
  const configs = project.hash?.project?.objects?.XCBuildConfiguration ?? {};
  for (const [key, buildConfig] of Object.entries(configs)) {
    if (key.endsWith('_comment')) continue;
    const buildSettings = buildConfig?.buildSettings;
    const infoPlistFile = String(buildSettings?.INFOPLIST_FILE ?? '');
    if (
      infoPlistFile.includes('../targets/StrideOSWatch/Info.plist')
      || infoPlistFile.includes('../targets/StrideRunLiveActivity/Info.plist')
    ) {
      buildSettings.CURRENT_PROJECT_VERSION = buildNumber;
    }
  }
}

function withIosWorkoutBackgroundModes(config) {
  config = withInfoPlist(config, (configWithPlist) => {
    addRequiredModes(configWithPlist.modResults);
    return configWithPlist;
  });

  config = withXcodeProject(config, (configWithProject) => {
    syncNativeTargetBuildNumbers(configWithProject.modResults, configWithProject.ios?.buildNumber);
    return configWithProject;
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
}

module.exports = withIosWorkoutBackgroundModes;
module.exports.syncNativeTargetBuildNumbers = syncNativeTargetBuildNumbers;
