/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'StrideRunLiveActivity',
  displayName: 'StrideOS Run',
  bundleIdentifier: '.liveactivity',
  deploymentTarget: '17.0',
  frameworks: ['ActivityKit', 'SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#A8B094',
    $widgetBackground: '#14160F',
  },
};
