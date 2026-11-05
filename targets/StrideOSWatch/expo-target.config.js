/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'StrideOSWatch',
  displayName: 'StrideOS',
  bundleIdentifier: '.watch',
  deploymentTarget: '10.0',
  icon: '../../assets/images/icon.png',
  frameworks: ['HealthKit', 'SwiftUI', 'WatchConnectivity', 'CoreLocation', 'CoreMotion'],
  entitlements: {
    'com.apple.developer.healthkit': true,
  },
  plist: {
    NSMotionUsageDescription: 'StrideOS reads your current step cadence during workouts.',
    NSHealthShareUsageDescription:
      'StrideOS uses the workout measurements you choose to share, such as heart rate, distance, energy, steps, running metrics, and cycling cadence or power, to record and review your activities.',
    NSHealthUpdateUsageDescription:
      'StrideOS saves completed Apple Watch workouts you record in StrideOS to Apple Health.',
    WKBackgroundModes: ['workout-processing'],
    UIBackgroundModes: ['location'],
    NSLocationWhenInUseUsageDescription:
      'StrideOS records your route on Apple Watch during outdoor workouts, so your run or hike is mapped even if your iPhone is off.',
  },
  colors: {
    $accent: '#A8B094',
  },
});
