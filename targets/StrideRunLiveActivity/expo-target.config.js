/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'StrideRunLiveActivity',
  displayName: 'StrideOS Run',
  bundleIdentifier: '.liveactivity',
  deploymentTarget: '18.0',
  frameworks: ['ActivityKit', 'AppIntents', 'SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [],
  },
  colors: {
    $accent: '#A8B094',
    $widgetBackground: '#14160F',
  },
});
