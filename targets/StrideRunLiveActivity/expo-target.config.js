/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'StrideRunLiveActivity',
  displayName: 'StrideOS Run',
  bundleIdentifier: '.liveactivity',
  // Interactive Live Activity controls use LiveActivityIntent, which requires
  // iOS 17+. Keep the extension floor aligned with the app's availability gate;
  // an iOS 18-only extension makes Live Activities appear broken on iOS 17.
  deploymentTarget: '17.0',
  frameworks: ['ActivityKit', 'AppIntents', 'SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [],
  },
  colors: {
    $accent: '#A8B094',
    $widgetBackground: '#14160F',
  },
});
