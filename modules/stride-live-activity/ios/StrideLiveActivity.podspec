require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'StrideLiveActivity'
  s.version        = package['version']
  s.summary        = 'Native Live Activity controls for StrideOS'
  s.description    = 'Expo native module for starting, updating, and ending StrideOS run Live Activities.'
  s.license        = { :type => 'MIT' }
  s.author         = 'StrideOS'
  s.homepage       = 'https://mooremovement.com'
  s.platform       = :ios, '16.4'
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'StrideLiveActivityCore'
  s.frameworks = 'ActivityKit', 'MapKit'
  s.source_files = 'Module/**/*.{swift,h,m,mm}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
