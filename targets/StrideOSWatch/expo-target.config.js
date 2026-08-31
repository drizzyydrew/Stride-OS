/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'StrideOSWatch',
  displayName: 'StrideOS',
  bundleIdentifier: '.watch',
  deploymentTarget: '10.0',
  icon: '../../assets/images/icon.png',
  frameworks: ['HealthKit', 'SwiftUI', 'WatchConnectivity'],
  entitlements: {
    'com.apple.developer.healthkit': true,
  },
  colors: {
    $accent: '#A8B094',
  },
});
