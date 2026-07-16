require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'StrideLiveActivityCore'
  s.version        = package['version']
  s.summary        = 'Shared ActivityKit attributes for StrideOS Live Activities'
  s.description    = 'Shared ActivityKit attributes for StrideOS run Live Activities.'
  s.license        = { :type => 'MIT' }
  s.author         = 'StrideOS'
  s.homepage       = 'https://mooremovement.com'
  s.platform       = :ios, '16.4'
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.frameworks = 'ActivityKit'
  s.source_files = 'Core/**/*.{swift,h,m,mm}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
