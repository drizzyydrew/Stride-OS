import Combine
import CoreLocation
import CoreMotion
import Foundation
import HealthKit
import WatchConnectivity
import WatchKit

enum StrideWatchWorkoutKind: String, CaseIterable, Identifiable {
  case run
  case strength
  case mobility
  case cycling
  case walking
  case hiking
  case downhillSkiing = "downhill_skiing"
  case crossCountrySkiing = "cross_country_skiing"
  case snowboarding
  case skiTouring = "ski_touring"
  case snowboardTouring = "snowboard_touring"

  var id: String { rawValue }

  var title: String {
    switch self {
    case .run: return "Run"
    case .strength: return "Strength"
    case .mobility: return "Mobility"
    case .cycling: return "Cycling"
    case .walking: return "Walk"
    case .hiking: return "Hike"
    case .downhillSkiing: return "Downhill Ski"
    case .crossCountrySkiing: return "XC Ski"
    case .snowboarding: return "Snowboard"
    case .skiTouring: return "Ski Touring"
    case .snowboardTouring: return "Snowboard Touring"
    }
  }

  var workoutTitle: String {
    switch self {
    case .run: return "StrideOS Run"
    case .strength: return "StrideOS Strength"
    case .mobility: return "StrideOS Mobility"
    case .cycling: return "StrideOS Ride"
    case .walking, .hiking, .downhillSkiing, .crossCountrySkiing, .snowboarding, .skiTouring, .snowboardTouring:
      return "StrideOS \(title)"
    }
  }

  var symbolName: String {
    switch self {
    case .run: return "figure.run"
    case .strength: return "dumbbell.fill"
    case .mobility: return "figure.cooldown"
    case .cycling: return "bicycle"
    case .walking: return "figure.walk"
    case .hiking: return "figure.hiking"
    case .downhillSkiing, .skiTouring: return "figure.skiing.downhill"
    case .crossCountrySkiing: return "figure.skiing.crosscountry"
    case .snowboarding, .snowboardTouring: return "figure.snowboarding"
    }
  }

  var activityType: HKWorkoutActivityType {
    switch self {
    case .run: return .running
    case .strength: return .traditionalStrengthTraining
    case .mobility: return .flexibility
    case .cycling: return .cycling
    case .walking: return .walking
    case .hiking, .skiTouring, .snowboardTouring: return .hiking
    case .downhillSkiing: return .downhillSkiing
    case .crossCountrySkiing: return .crossCountrySkiing
    case .snowboarding: return .snowboarding
    }
  }

  var distanceIdentifier: HKQuantityTypeIdentifier? {
    switch self {
    case .run: return .distanceWalkingRunning
    case .walking, .hiking, .skiTouring, .snowboardTouring: return .distanceWalkingRunning
    case .cycling: return .distanceCycling
    case .downhillSkiing, .snowboarding: return .distanceDownhillSnowSports
    // HealthKit has no guaranteed built-in XC distance stream. GPS route is
    // still recorded; do not label walking/running distance as ski distance.
    case .crossCountrySkiing: return nil
    case .strength, .mobility: return nil
    }
  }

  var tracksDistance: Bool {
    self != .strength && self != .mobility
  }

  var speedBased: Bool {
    self == .cycling || self == .downhillSkiing || self == .crossCountrySkiing
      || self == .snowboarding || self == .skiTouring || self == .snowboardTouring
  }

  static func from(_ value: String?) -> StrideWatchWorkoutKind? {
    guard let value else { return .run }
    return StrideWatchWorkoutKind(rawValue: value)
  }
}

enum StrideWatchMetricPage: Int, CaseIterable, Identifiable {
  case elapsed
  case heartRate
  case distance
  case pace
  case heartRateZone
  case energy
  case cadence
  case power

  var id: Int { rawValue }

  var title: String {
    switch self {
    case .elapsed: return "Time"
    case .heartRate: return "Heart Rate"
    case .distance: return "Distance"
    case .pace: return "Pace"
    case .heartRateZone: return "HR Zone"
    case .energy: return "Energy"
    case .cadence: return "Cadence"
    case .power: return "Power"
    }
  }
}

final class StrideWatchWorkoutManager: NSObject, ObservableObject {
  static let shared = StrideWatchWorkoutManager()

  @Published private(set) var heartRateBpm: Int?
  @Published private(set) var cadenceSpm: Double?
  @Published private(set) var cyclingCadenceRpm: Double?
  @Published private(set) var currentPowerWatts: Double?
  private var heartRateObservedAt: Date?
  private var cadenceObservedAt: Date?
  private var powerObservedAt: Date?
  private let pedometer = CMPedometer()
  @Published private(set) var state: HKWorkoutSessionState = .notStarted
  @Published private(set) var elapsedSeconds: Int = 0
  @Published private(set) var lastError: String?
  @Published private(set) var selectedWorkoutKind: StrideWatchWorkoutKind = .run
  @Published private(set) var distanceMeters: Double = 0
  @Published private(set) var activeEnergyKilocalories: Double = 0
  @Published private(set) var pendingSyncCount: Int = 0
  @Published private(set) var preferredUnitSystem: String = "imperial"
  @Published private(set) var metricPage: StrideWatchMetricPage = .heartRate
  @Published private(set) var isStartingWorkout: Bool = false
  // Runtime diagnostics shown on the watch screen (main thread only).
  @Published private(set) var connectivityLabel: String = "WC: not activated"
  @Published private(set) var lastCommandLabel: String = "Cmd: none"
  @Published private(set) var healthKitLabel: String = "HK: idle"
  @Published private(set) var workoutIdLabel: String = "ID: --"
  /// Where the previous workout start ended up. When the last recorded step is
  /// not terminal, the app was killed during that step (i.e. it crashed there).
  @Published private(set) var startTrailLabel: String?
  @Published private(set) var startTrailCrashed: Bool = false

  private var maxHeartRateBpm: Int = 190
  private var targetZone: Int?

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var workoutInstanceId: String?
  private var workoutEnvironment: String = "outdoor"
  private var startedAt: Date?
  private var pausedAt: Date?
  private var pausedSeconds: TimeInterval = 0
  private var timer: Timer?
  private var endedStateSentForWorkoutInstanceId: String?
  private var handledPhoneCommandKeys: [String] = []
  private var isEnding = false
  private var startWatchdog: DispatchWorkItem?
  // Auto-launch (iPhone called HKHealthStore.startWatchApp while this app
  // wasn't running). The session starts under a provisional id so the app is
  // reachable; the phone's live start then adopts it. These flags are only
  // ever set by startProvisionalWorkoutFromLaunch, so a normal open-app start
  // never enters any of the provisional branches.
  private var isProvisionalLaunch = false
  // Identity, not a flag: only this exact session is discarded, so a stale
  // marker can never discard (or silence) a later real workout.
  private weak var discardSession: HKWorkoutSession?
  // Launch timed out before HealthKit created the session: discard it as
  // soon as it reports running.
  private var discardWhenRunning = false
  private var provisionalTimeout: DispatchWorkItem?
  private let provisionalLaunchWindowSeconds: TimeInterval = 60
  // Watch GPS route (Build 91): recorded into Health for outdoor distance
  // workouts so the route survives even if the iPhone dies. Only active when
  // permission already exists — never prompts inside a start.
  private var locationManager: CLLocationManager?
  private var routeBuilder: HKWorkoutRouteBuilder?
  private var xcDistanceAnchor: CLLocation?
  private var routePermissionsRequested = false
  private var lastCommandReceivedAt: Date?
  private var queuedOutboundPayloads: [[String: Any]] = []
  private var pendingConnectivityActivationWorkItem: DispatchWorkItem?
  private var suppressNextConnectivityActivationError = false
  private let stalePhoneCommandWindowMs: Double = 2 * 60 * 1000
  private let stalePhoneContextWindowMs: Double = 4 * 60 * 60 * 1000

  var isActive: Bool {
    state == .running || state == .paused || state == .prepared
  }

  var isRunning: Bool {
    state == .running
  }

  var isPaused: Bool {
    state == .paused
  }

  var statusLabel: String {
    if let lastError {
      return lastError
    }
    switch state {
    case .notStarted: return "Ready"
    case .prepared: return "Preparing"
    case .running: return "Running"
    case .paused: return "Paused"
    case .stopped: return "Stopping"
    case .ended: return "Complete"
    @unknown default: return "Ready"
    }
  }

  var syncLabel: String {
    if pendingSyncCount > 0 {
      return "\(pendingSyncCount) queued"
    }
    return WCSession.isSupported() && WCSession.default.isReachable ? "Phone live" : "Offline ready"
  }

  var availableMetricPages: [StrideWatchMetricPage] {
    var pages: [StrideWatchMetricPage] = selectedWorkoutKind.tracksDistance
      ? [.heartRate, .heartRateZone, .distance, .pace, .elapsed, .energy]
      : [.heartRate, .heartRateZone, .elapsed, .energy]
    if selectedWorkoutKind == .run { pages += [.cadence, .power] }
    if selectedWorkoutKind == .cycling { pages += [.cadence, .power] }
    return pages
  }

  var metricPageTitle: String {
    if metricPage == .power && selectedWorkoutKind == .run { return "Power (est.)" }
    if metricPage == .pace && selectedWorkoutKind.speedBased { return "Speed" }
    return metricPage.title
  }

  var elapsedLabel: String {
    let hours = elapsedSeconds / 3600
    let minutes = (elapsedSeconds % 3600) / 60
    let seconds = elapsedSeconds % 60
    if hours > 0 {
      return "\(hours):\(String(format: "%02d", minutes)):\(String(format: "%02d", seconds))"
    }
    return "\(minutes):\(String(format: "%02d", seconds))"
  }

  var distanceLabel: String {
    guard selectedWorkoutKind.tracksDistance else { return "--" }
    let value = preferredUnitSystem == "metric" ? distanceMeters / 1000 : distanceMeters / 1609.344
    return String(format: value >= 10 ? "%.1f" : "%.2f", value)
  }

  var distanceUnitLabel: String {
    preferredUnitSystem == "metric" ? "km" : "mi"
  }

  var paceLabel: String {
    guard selectedWorkoutKind.tracksDistance, distanceMeters > 10, elapsedSeconds > 0 else {
      return "--:--"
    }
    let unitDistance = preferredUnitSystem == "metric" ? distanceMeters / 1000 : distanceMeters / 1609.344
    guard unitDistance > 0 else { return "--:--" }
    if selectedWorkoutKind.speedBased { return String(format: "%.1f", unitDistance / Double(elapsedSeconds) * 3600) }
    let secondsPerUnit = Int((Double(elapsedSeconds) / unitDistance).rounded())
    return "\(secondsPerUnit / 60):\(String(format: "%02d", secondsPerUnit % 60))"
  }

  var paceUnitLabel: String {
    if selectedWorkoutKind.speedBased { return preferredUnitSystem == "metric" ? "km/h" : "mph" }
    return preferredUnitSystem == "metric" ? "/km" : "/mi"
  }

  var heartRateZoneLabel: String {
    guard let bpm = heartRateBpm, bpm > 0, let date = heartRateObservedAt,
      state == .running, Date().timeIntervalSince(date) >= 0, Date().timeIntervalSince(date) <= 10 else {
      return "Z--"
    }
    let ratio = Double(bpm) / Double(max(maxHeartRateBpm, 1))
    if ratio < 0.60 { return "Z1" }
    if ratio < 0.70 { return "Z2" }
    if ratio < 0.80 { return "Z3" }
    if ratio < 0.90 { return "Z4" }
    return "Z5"
  }

  var metricValueLabel: String {
    switch metricPage {
    case .elapsed: return elapsedLabel
    case .heartRate: return freshValue(heartRateBpm.map(Double.init), at: heartRateObservedAt)
    case .distance: return distanceLabel
    case .pace: return paceLabel
    case .heartRateZone: return heartRateZoneLabel
    case .energy: return String(Int(activeEnergyKilocalories.rounded()))
    case .cadence: return freshValue(selectedWorkoutKind == .cycling ? cyclingCadenceRpm : cadenceSpm, at: cadenceObservedAt)
    case .power: return freshValue(currentPowerWatts, at: powerObservedAt)
    }
  }

  var metricUnitLabel: String {
    switch metricPage {
    case .elapsed: return ""
    case .heartRate: return "bpm"
    case .distance: return distanceUnitLabel
    case .pace: return paceUnitLabel
    case .heartRateZone: return ""
    case .energy: return "kcal"
    case .cadence: return selectedWorkoutKind == .cycling ? "rpm" : "spm"
    case .power: return "W"
    }
  }

  private override init() {
    super.init()
    StrideWatchStartTrail.installExceptionHandler()
    if let previous = StrideWatchStartTrail.read() {
      startTrailCrashed = !previous.terminal
      startTrailLabel = previous.terminal
        ? "Last start: \(previous.step)"
        : "Crashed at: \(previous.step)"
    }
  }

  // MARK: - Threading
  //
  // HealthKit and WatchConnectivity deliver delegate callbacks on background
  // queues. Every method below that touches published state, the outbound
  // queue, or the workout session runs on the main thread; callbacks hop in
  // before doing anything else.

  private func onMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread {
      block()
    } else {
      DispatchQueue.main.async(execute: block)
    }
  }

  func prepareForPhoneControl() {
    guard WCSession.isSupported() else { return }
    scheduleConnectivityActivation(reportErrors: false, delay: 1.5)
    requestRoutePermissionsWhenIdle()
  }

  /// Asks once, while the watch app is open and idle, for location access.
  /// Never called from a start. The Health route permission is NOT requested
  /// here: HealthKit serializes permission sheets, so a watch-side request
  /// could stall a phone start. It is granted on the iPhone (shared with the
  /// watch app); without it the watch simply records no route.
  private func requestRoutePermissionsWhenIdle() {
    onMain {
      guard !self.routePermissionsRequested, !self.isActive, !self.isStartingWorkout else { return }
      DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
        guard !self.routePermissionsRequested, !self.isActive, !self.isStartingWorkout else { return }
        self.routePermissionsRequested = true
        let manager = CLLocationManager()
        if manager.authorizationStatus == .notDetermined {
          self.locationManager = manager
          manager.requestWhenInUseAuthorization()
        }
      }
    }
  }

  /// allowsBackgroundLocationUpdates raises an exception unless the bundle
  /// declares the location background mode, so only enable it when present.
  private static let bundleAllowsBackgroundLocation: Bool = {
    let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
    return modes.contains("location")
  }()

  private var canRecordRoute: Bool {
    let status = (locationManager ?? CLLocationManager()).authorizationStatus
    let locationOK = status == .authorizedWhenInUse || status == .authorizedAlways
    return locationOK && healthStore.authorizationStatus(for: HKSeriesType.workoutRoute()) == .sharingAuthorized
  }

  private func startRouteRecordingIfPossible(kind: StrideWatchWorkoutKind, environment: String?) {
    let authorization = (locationManager ?? CLLocationManager()).authorizationStatus
    guard kind.tracksDistance, environment != "indoor",
      authorization == .authorizedWhenInUse || authorization == .authorizedAlways else { return }
    let manager = locationManager ?? CLLocationManager()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.activityType = kind == .cycling ? .otherNavigation : .fitness
    manager.distanceFilter = kCLDistanceFilterNone
    if Self.bundleAllowsBackgroundLocation {
      manager.allowsBackgroundLocationUpdates = true
    }
    locationManager = manager
    routeBuilder = canRecordRoute ? HKWorkoutRouteBuilder(healthStore: healthStore, device: nil) : nil
    xcDistanceAnchor = nil
    manager.startUpdatingLocation()
  }

  private func stopRouteRecording() {
    xcDistanceAnchor = nil
    locationManager?.stopUpdatingLocation()
    locationManager?.delegate = nil
  }

  /// Stops GPS and drops any unfinished route (failed or replaced session).
  private func abandonRoute() {
    pedometer.stopUpdates()
    stopRouteRecording()
    finishRoute(for: nil)
  }

  /// Attaches the recorded route to the saved workout (or drops it).
  private func finishRoute(for workout: HKWorkout?) {
    let routeBuilder = self.routeBuilder
    self.routeBuilder = nil
    guard let routeBuilder else { return }
    if let workout {
      routeBuilder.finishRoute(with: workout, metadata: nil) { _, _ in }
    } else {
      routeBuilder.discard()
    }
  }

  /// The iPhone launched this app to start a workout (HKHealthStore
  /// .startWatchApp -> WKApplicationDelegate.handle). Per Apple's contract the
  /// app starts the session here; a running session is what makes the app
  /// reachable so the phone's live start (with the real workoutInstanceId)
  /// can arrive and be adopted. Discarded if no phone start comes.
  func startProvisionalWorkoutFromLaunch(_ configuration: HKWorkoutConfiguration) {
    onMain {
      // Connect right away (no 1.5 s launch delay): the phone is waiting to
      // resend its start the moment this app becomes reachable.
      self.scheduleConnectivityActivation(reportErrors: false, delay: 0)
      guard !self.isActive, !self.isStartingWorkout else { return }
      let kind: StrideWatchWorkoutKind
      switch configuration.activityType {
      case .running: kind = .run
      case .cycling: kind = .cycling
      case .traditionalStrengthTraining: kind = .strength
      case .flexibility: kind = .mobility
      case .walking: kind = .walking
      case .hiking: kind = .hiking
      case .downhillSkiing: kind = .downhillSkiing
      case .crossCountrySkiing: kind = .crossCountrySkiing
      case .snowboarding: kind = .snowboarding
      default:
        self.publishError("Unsupported workout type")
        return
      }
      let environment = configuration.locationType == .indoor ? "indoor" : "outdoor"
      // Int64: 32-bit watches (Series 4-8, SE) trap on Int(ms).
      let provisionalId = "launch_\(Int64(Date().timeIntervalSince1970 * 1000))"
      StrideWatchStartTrail.mark("L launched by iPhone (\(kind.rawValue))")
      guard self.startWorkout(
        kind: kind,
        title: nil,
        workoutInstanceId: provisionalId,
        environment: environment,
        targetZone: nil
      ) == nil else { return }
      self.isProvisionalLaunch = true
      self.armProvisionalTimeout()
    }
  }

  /// A live phone start while a provisional launch session is starting or
  /// running: take the phone's workoutInstanceId instead of rejecting it as
  /// already active. Returns false (no-op) outside a provisional launch.
  private func adoptPhoneStartIfProvisional(_ message: [String: Any]) -> Bool {
    // Never adopt into a session that is ending or being discarded; the phone
    // start then goes through the normal start path instead.
    guard isProvisionalLaunch, isActive || isStartingWorkout,
      !isEnding, discardSession == nil, !discardWhenRunning else { return false }
    guard let requestedKind = StrideWatchWorkoutKind.from(message["workoutKind"] as? String),
      requestedKind.activityType == selectedWorkoutKind.activityType else { return false }
    selectedWorkoutKind = requestedKind
    isProvisionalLaunch = false
    provisionalTimeout?.cancel()
    provisionalTimeout = nil
    if let id = message["workoutInstanceId"] as? String, !id.isEmpty {
      workoutInstanceId = id
      workoutIdLabel = "ID: \(String(id.suffix(8)))"
      endedStateSentForWorkoutInstanceId = nil
    }
    // Adoption replaces the provisional Health recording ID with the phone ID.
    builder?.addMetadata(recordingMetadata(for: requestedKind)) { _, _ in }
    if let zone = message["targetZone"] as? Int {
      targetZone = zone
    }
    if state == .running {
      StrideWatchStartTrail.mark("running OK (adopted phone start)", terminal: true)
      sendWorkoutState("running")
    }
    return true
  }

  private var isDiscardingCurrentSession: Bool {
    guard let discardSession, let session else { return false }
    return discardSession === session
  }

  private func armProvisionalTimeout() {
    provisionalTimeout?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self, self.isProvisionalLaunch else { return }
      StrideWatchStartTrail.mark("launch discarded: no phone start", terminal: true)
      guard let session = self.session else {
        // HealthKit hasn't created the session yet; drop it when it runs.
        self.isProvisionalLaunch = false
        self.discardWhenRunning = true
        return
      }
      // Nothing to keep: end without saving an empty workout to Health.
      // isProvisionalLaunch stays true until .ended so no state is reported.
      self.discardSession = session
      self.endWorkout()
    }
    provisionalTimeout = item
    DispatchQueue.main.asyncAfter(deadline: .now() + provisionalLaunchWindowSeconds, execute: item)
  }

  /// Returns nil when the start was accepted, or a short rejection reason.
  /// Must be called on the main thread.
  @discardableResult
  func startWorkout(
    kind: StrideWatchWorkoutKind = .run,
    title: String?,
    workoutInstanceId: String?,
    environment: String?,
    targetZone: Int?
  ) -> String? {
    guard !isActive else { return "already_active" }
    guard !isStartingWorkout else { return "already_starting" }
    // A new start supersedes any pending launch state. (A launch start sets
    // isProvisionalLaunch again right after this returns.)
    discardWhenRunning = false
    isProvisionalLaunch = false
    provisionalTimeout?.cancel()
    provisionalTimeout = nil
    StrideWatchStartTrail.mark("2 start accepted (\(kind.rawValue))")
    lastError = nil
    isStartingWorkout = true
    isEnding = false
    healthKitLabel = "HK: requesting auth"
    let resolvedEnvironment = environment ?? (kind.tracksDistance ? "outdoor" : "indoor")
    // Int64: on 32-bit watches (arm64_32: Series 4-8, SE) Int is 32-bit and a
    // millisecond timestamp overflows it, which traps and kills the app.
    let resolvedId = workoutInstanceId ?? "watch_\(kind.rawValue)_\(Int64(Date().timeIntervalSince1970 * 1000))"
    self.workoutInstanceId = resolvedId
    self.workoutIdLabel = "ID: \(String(resolvedId.suffix(8)))"
    self.endedStateSentForWorkoutInstanceId = nil
    self.selectedWorkoutKind = kind
    self.workoutEnvironment = resolvedEnvironment
    self.targetZone = targetZone
    self.metricPage = kind.tracksDistance ? .heartRate : .elapsed
    armStartWatchdog()

    StrideWatchStartTrail.mark("3 auth request")
    requestAuthorization { [weak self] granted in
      guard let self else { return }
      StrideWatchStartTrail.mark("5 auth done granted=\(granted)")
      self.onMain {
        StrideWatchStartTrail.mark("6 main hop")
        guard granted else {
          self.failStart("Health permission needed.", label: "HK: auth denied")
          return
        }
        self.healthKitLabel = "HK: starting"
        self.beginWorkout(kind: kind, environment: resolvedEnvironment)
      }
    }
    return nil
  }

  func selectWorkoutKind(_ kind: StrideWatchWorkoutKind) {
    guard !isActive else { return }
    selectedWorkoutKind = kind
    metricPage = kind.tracksDistance ? .heartRate : .elapsed
  }

  func enableCadence() {
    guard !isActive, !isStartingWorkout, CMPedometer.isCadenceAvailable() else { return }
    // Explicit idle permission action, never a new sheet during run startup.
    let now = Date()
    pedometer.queryPedometerData(from: now.addingTimeInterval(-1), to: now) { [weak self] _, _ in
      DispatchQueue.main.async { self?.objectWillChange.send() }
    }
  }

  var canEnableCadence: Bool {
    CMPedometer.isCadenceAvailable() && CMPedometer.authorizationStatus() == .notDetermined
  }

  func enableWorkoutMetrics() {
    guard !isActive, !isStartingWorkout, WKExtension.shared().applicationState == .active,
      HKHealthStore.isHealthDataAvailable() else { return }
    let identifiers = Set(StrideWatchWorkoutKind.allCases.flatMap { optionalMetricIdentifiers(for: $0) }
      + [.distanceDownhillSnowSports])
    let readTypes = Set(identifiers.compactMap { HKObjectType.quantityType(forIdentifier: $0) })
    healthStore.requestAuthorization(toShare: [], read: readTypes) { [weak self] _, error in
      if let error { self?.publishError(error.localizedDescription) }
    }
  }

  func cycleMetricPage() {
    let pages = availableMetricPages
    guard let currentIndex = pages.firstIndex(of: metricPage) else {
      metricPage = pages.first ?? .heartRate
      return
    }
    metricPage = pages[(currentIndex + 1) % pages.count]
  }

  func pauseWorkout() {
    guard let session, session.state == .running else { return }
    session.pause()
    xcDistanceAnchor = nil
    pausedAt = Date()
    // "paused" is published from the HealthKit delegate callback.
  }

  func resumeWorkout() {
    guard let session, session.state == .paused else { return }
    if let pausedAt {
      pausedSeconds += Date().timeIntervalSince(pausedAt)
    }
    pausedAt = nil
    xcDistanceAnchor = nil
    session.resume()
    // "running" is published from the HealthKit delegate callback.
  }

  func endWorkout() {
    guard !isEnding else { return }
    guard let session else {
      if isActive {
        isEnding = true
        timer?.invalidate()
        timer = nil
        sendEndedStateOnce()
      }
      return
    }
    // HealthKit throws "Unable to perform 'end' from current state" if end()
    // is called again once the session is stopping or ended.
    guard session.state == .running || session.state == .paused || session.state == .prepared else { return }
    isEnding = true
    healthKitLabel = "HK: ending"
    session.end()
    timer?.invalidate()
    timer = nil
  }

  private func armStartWatchdog() {
    startWatchdog?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self, self.isStartingWorkout, self.state != .running else { return }
      self.failStart("Workout did not start. Try again from iPhone.", label: "HK: start timed out")
    }
    startWatchdog = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: item)
  }

  private func clearStartWatchdog() {
    startWatchdog?.cancel()
    startWatchdog = nil
  }

  private func failStart(_ message: String, label: String) {
    StrideWatchStartTrail.mark("failed: \(message)", terminal: true)
    clearStartWatchdog()
    isStartingWorkout = false
    healthKitLabel = label
    abandonRoute()
    publishError(message)
  }

  private func recordingMetadata(for kind: StrideWatchWorkoutKind) -> [String: Any] {
    var metadata: [String: Any] = [HKMetadataKeyWorkoutBrandName: "StrideOS", "StrideOSSport": kind.rawValue]
    if let workoutInstanceId, !workoutInstanceId.isEmpty {
      metadata["StrideOSWorkoutInstanceId"] = workoutInstanceId
    }
    return metadata
  }

  private func beginWorkout(kind: StrideWatchWorkoutKind, environment: String?) {
    abandonRoute()
    if let existing = session {
      if existing.state == .running || existing.state == .paused || existing.state == .prepared {
        existing.end()
      }
      session = nil
      builder = nil
    }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = kind.activityType
    if kind.tracksDistance {
      configuration.locationType = environment == "indoor" ? .indoor : .outdoor
    } else {
      configuration.locationType = .indoor
    }

    do {
      StrideWatchStartTrail.mark("7 create session")
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      StrideWatchStartTrail.mark("8 get builder")
      let builder = session.associatedWorkoutBuilder()
      StrideWatchStartTrail.mark("9 data source")
      let dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
      for identifier in optionalMetricIdentifiers(for: kind) {
        if let type = HKObjectType.quantityType(forIdentifier: identifier) { dataSource.enableCollection(for: type, predicate: nil) }
      }
      builder.dataSource = dataSource
      StrideWatchStartTrail.mark("10 set delegates")
      session.delegate = self
      builder.delegate = self
      self.session = session
      self.builder = builder
      builder.addMetadata(recordingMetadata(for: kind)) { _, _ in }

      let now = Date()
      startedAt = now
      pausedAt = nil
      pausedSeconds = 0
      elapsedSeconds = 0
      heartRateBpm = nil
      heartRateObservedAt = nil
      cadenceSpm = nil
      cyclingCadenceRpm = nil
      cadenceObservedAt = nil
      currentPowerWatts = nil
      powerObservedAt = nil
      distanceMeters = 0
      activeEnergyKilocalories = 0

      StrideWatchStartTrail.mark("11 startActivity")
      session.startActivity(with: now)
      StrideWatchStartTrail.mark("12 beginCollection")
      builder.beginCollection(withStart: now) { [weak self] success, error in
        StrideWatchStartTrail.mark("14 collection cb ok=\(success)")
        guard let self else { return }
        if let error {
          self.publishError(error.localizedDescription)
        } else if !success {
          self.publishError("Workout collection did not start")
        }
      }
      StrideWatchStartTrail.mark("13 timer")
      startTimer()
      startRouteRecordingIfPossible(kind: kind, environment: environment)
      startCadenceIfAvailable(kind: kind, startedAt: now)
      // isStartingWorkout stays true and "running" is published only when the
      // HealthKit delegate reports .running, so the phone never sees a running
      // workout that HealthKit has not actually started.
    } catch {
      failStart("HealthKit did not start: \(error.localizedDescription)", label: "HK: error")
    }
  }

  private func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    guard HKHealthStore.isHealthDataAvailable() else {
      completion(false)
      return
    }

    let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate)
    let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
    let runDistance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
    let cyclingDistance = HKObjectType.quantityType(forIdentifier: .distanceCycling)
    // Keep Build 90's required startup scopes unchanged. New metrics are opt-in
    // from the foreground idle screen, never underneath the start watchdog.
    let readTypes = Set([heartRate, activeEnergy, runDistance, cyclingDistance].compactMap { $0 })
    let shareTypes: Set<HKSampleType> = [HKObjectType.workoutType()]

    healthStore.requestAuthorization(toShare: shareTypes, read: readTypes) { [weak self] granted, error in
      StrideWatchStartTrail.mark("4 auth callback")
      if let error {
        self?.publishError(error.localizedDescription)
      }
      completion(granted)
    }
  }

  private func optionalMetricIdentifiers(for kind: StrideWatchWorkoutKind) -> [HKQuantityTypeIdentifier] {
    switch kind {
    case .run:
      return [.stepCount, .runningPower, .runningSpeed, .runningGroundContactTime, .runningStrideLength, .runningVerticalOscillation]
    case .walking, .hiking, .skiTouring, .snowboardTouring: return [.stepCount]
    case .cycling: return [.cyclingCadence, .cyclingPower]
    default: return []
    }
  }

  private func startTimer() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.refreshElapsed()
    }
  }

  private func refreshElapsed() {
    guard let startedAt else {
      elapsedSeconds = 0
      return
    }
    let activePause = pausedAt.map { Date().timeIntervalSince($0) } ?? 0
    elapsedSeconds = max(0, Int(Date().timeIntervalSince(startedAt) - pausedSeconds - activePause))
  }

  private func freshValue(_ value: Double?, at date: Date?) -> String {
    guard state == .running, let value, value.isFinite, value >= 0, value < Double(Int32.max), let date, Date().timeIntervalSince(date) >= 0,
      Date().timeIntervalSince(date) <= 10 else { return "--" }
    return String(Int(value.rounded()))
  }

  private func startCadenceIfAvailable(kind: StrideWatchWorkoutKind, startedAt: Date) {
    pedometer.stopUpdates()
    guard kind == .run || kind == .walking || kind == .hiking,
      CMPedometer.isCadenceAvailable(), CMPedometer.authorizationStatus() == .authorized else { return }
    guard let cadenceSession = session else { return }
    pedometer.startUpdates(from: startedAt) { [weak self] data, _ in
      guard let data, let cadence = data.currentCadence?.doubleValue, cadence.isFinite, cadence >= 0 else { return }
      DispatchQueue.main.async {
        guard let self, self.session === cadenceSession, self.state == .running else { return }
        self.cadenceSpm = cadence * 60
        self.cadenceObservedAt = data.endDate
        self.sendTelemetry(["cadenceSpm": cadence * 60], at: data.endDate)
      }
    }
  }

  private func sendTelemetry(_ values: [String: Any], at date: Date) {
    guard !isProvisionalLaunch, !isDiscardingCurrentSession, state == .running else { return }
    var payload = values
    payload["type"] = "telemetry"
    payload["workoutInstanceId"] = workoutInstanceId
    payload["workoutKind"] = selectedWorkoutKind.rawValue
    payload["timestamp"] = date.timeIntervalSince1970 * 1000
    payload["source"] = "apple_watch"
    sendToPhone(payload)
  }

  private func finishBuilderIfNeeded() {
    // Take this workout's route now, so a quick restart can't hand the next
    // workout's route builder to this workout's completion.
    let routeBuilder = self.routeBuilder
    self.routeBuilder = nil
    guard let builder else {
      routeBuilder?.discard()
      return
    }
    builder.endCollection(withEnd: Date()) { [weak self] _, _ in
      builder.finishWorkout { workout, error in
        if let routeBuilder {
          if let workout {
            routeBuilder.finishRoute(with: workout, metadata: nil) { _, _ in }
          } else {
            routeBuilder.discard()
          }
        }
        if let error {
          self?.publishError(error.localizedDescription)
        }
      }
    }
  }

  private func activateWatchConnectivity(reportErrors: Bool = true) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    if session.activationState == .notActivated {
      suppressNextConnectivityActivationError = !reportErrors
      session.activate()
    }
    refreshConnectivityLabel()
  }

  private func scheduleConnectivityActivation(reportErrors: Bool = false, delay: TimeInterval = 2.0) {
    guard WCSession.isSupported() else { return }
    pendingConnectivityActivationWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      self?.activateWatchConnectivity(reportErrors: reportErrors)
    }
    pendingConnectivityActivationWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
  }

  private func refreshConnectivityLabel() {
    onMain {
      guard WCSession.isSupported() else {
        self.connectivityLabel = "WC: unsupported"
        return
      }
      let session = WCSession.default
      let activation: String
      switch session.activationState {
      case .activated: activation = "active"
      case .inactive: activation = "inactive"
      case .notActivated: activation = "not activated"
      @unknown default: activation = "unknown"
      }
      self.connectivityLabel = "WC: \(activation) · \(session.isReachable ? "reachable" : "not reachable")"
    }
  }

  private func sendHeartRate(_ bpm: Int) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendHeartRate(bpm) }
      return
    }
    guard let heartRateObservedAt, !isProvisionalLaunch, !isDiscardingCurrentSession else { return }
    var payload: [String: Any] = [
      "type": "heartRate",
      "heartRate": bpm,
      "elapsedSeconds": elapsedSeconds,
      "workoutKind": selectedWorkoutKind.rawValue,
      "environment": workoutEnvironment,
      "distanceMeters": distanceMeters,
      "activeEnergyKilocalories": activeEnergyKilocalories,
      "heartRateZone": heartRateZoneLabel,
      "timestamp": heartRateObservedAt.timeIntervalSince1970 * 1000,
      "source": "apple_watch",
    ]
    if let workoutInstanceId {
      payload["workoutInstanceId"] = workoutInstanceId
    }
    sendToPhone(payload)
  }

  private func sendWorkoutState(_ label: String) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendWorkoutState(label) }
      return
    }
    // A provisional launch session (not yet adopted by the phone) or one being
    // discarded must not report state: the phone would apply "running"/"ended"
    // to whatever it has active. Both flags are false outside auto-launch.
    if isProvisionalLaunch || isDiscardingCurrentSession { return }
    refreshElapsed()
    var payload: [String: Any] = [
      "type": "workoutState",
      "state": label,
      "elapsedSeconds": elapsedSeconds,
      "workoutKind": selectedWorkoutKind.rawValue,
      "environment": workoutEnvironment,
      "distanceMeters": distanceMeters,
      "activeEnergyKilocalories": activeEnergyKilocalories,
      "heartRateZone": heartRateZoneLabel,
      "pendingSyncCount": pendingSyncCount,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "source": "apple_watch",
    ]
    if let heartRateBpm, let observed = heartRateObservedAt, Date().timeIntervalSince(observed) >= 0, Date().timeIntervalSince(observed) <= 10 {
      payload["heartRate"] = heartRateBpm
      payload["heartRateTimestamp"] = heartRateObservedAt.map { $0.timeIntervalSince1970 * 1000 }
    }
    if let workoutInstanceId {
      payload["workoutInstanceId"] = workoutInstanceId
    }
    sendToPhone(payload)
  }

  private func sendEndedStateOnce() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendEndedStateOnce() }
      return
    }
    let key = workoutInstanceId ?? "ended_\(selectedWorkoutKind.rawValue)"
    guard endedStateSentForWorkoutInstanceId != key else { return }
    endedStateSentForWorkoutInstanceId = key
    sendWorkoutState("ended")
  }

  private func sendCommandAck(
    command: String,
    message: [String: Any],
    reason: String?
  ) {
    var payload: [String: Any] = [
      "type": "commandAck",
      "command": command,
      "accepted": reason == nil,
      "healthKitState": statusLabel.lowercased(),
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    if let reason {
      payload["reason"] = reason
    }
    if let id = (message["workoutInstanceId"] as? String) ?? workoutInstanceId {
      payload["workoutInstanceId"] = id
    }
    sendToPhone(payload)
  }

  private func sendToPhone(_ payload: [String: Any], reportFailures: Bool = true) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendToPhone(payload, reportFailures: reportFailures) }
      return
    }
    guard WCSession.isSupported() else { return }
    let session = WCSession.default

    guard session.activationState == .activated else {
      queuedOutboundPayloads.append(payload)
      if queuedOutboundPayloads.count > 40 {
        queuedOutboundPayloads.removeFirst(queuedOutboundPayloads.count - 40)
      }
      scheduleConnectivityActivation(reportErrors: false)
      return
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { [weak self] error in
        guard let self else { return }
        // Live delivery failed (phone went unreachable mid-send). State, acks,
        // and errors must still reach the phone, so queue them; heart-rate
        // samples are high-frequency and superseded, so they are dropped.
        let type = payload["type"] as? String
        if type == "workoutState" || type == "commandAck" || type == "error" {
          DispatchQueue.main.async {
            var queuedPayload = payload
            queuedPayload["queued"] = true
            WCSession.default.transferUserInfo(queuedPayload)
            self.pendingSyncCount += 1
          }
        }
        if reportFailures {
          self.recordLocalError(error.localizedDescription)
        }
      }
    } else {
      // Unreachable phone: queue only what still matters when it arrives
      // late. Heart-rate samples are superseded every few seconds (the full
      // workout, with HR, is saved to Apple Health), so they are not queued.
      if ["heartRate", "telemetry"].contains(payload["type"] as? String ?? "") { return }
      var queuedPayload = payload
      queuedPayload["queued"] = true
      session.transferUserInfo(queuedPayload)
      pendingSyncCount += 1
    }
  }

  private func flushQueuedOutboundPayloads() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.flushQueuedOutboundPayloads() }
      return
    }
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    let payloads = queuedOutboundPayloads
    queuedOutboundPayloads.removeAll()
    payloads.forEach { sendToPhone($0) }
  }

  private func publishError(_ message: String) {
    onMain {
      self.lastError = message
      self.sendToPhone([
        "type": "error",
        "message": message,
        "timestamp": Date().timeIntervalSince1970 * 1000,
      ], reportFailures: false)
    }
  }

  private func recordLocalError(_ message: String) {
    DispatchQueue.main.async {
      self.lastError = message
    }
  }

  fileprivate func handleWorkoutSessionStateChange(_ toState: HKWorkoutSessionState) {
    state = toState

    switch toState {
    case .running:
      if discardWhenRunning {
        discardWhenRunning = false
        discardSession = session
        isProvisionalLaunch = true
        clearStartWatchdog()
        isStartingWorkout = false
        endWorkout()
        return
      }
      if isStartingWorkout {
        StrideWatchStartTrail.mark("running OK", terminal: true)
      }
      clearStartWatchdog()
      isStartingWorkout = false
      healthKitLabel = "HK: running"
      sendWorkoutState("running")
    case .paused:
      healthKitLabel = "HK: paused"
      sendWorkoutState("paused")
    case .ended:
      clearStartWatchdog()
      healthKitLabel = "HK: ended"
      // An unadopted launch session never reported state, so it must not
      // report "ended" either (false on every normal-path workout).
      let discarding = isDiscardingCurrentSession
      let suppressEndedState = isProvisionalLaunch || discarding
      isProvisionalLaunch = false
      provisionalTimeout?.cancel()
      provisionalTimeout = nil
      discardSession = nil
      stopRouteRecording()
      pedometer.stopUpdates()
      if discarding {
        builder?.discardWorkout()
        finishRoute(for: nil)
      } else {
        finishBuilderIfNeeded()
      }
      if !suppressEndedState {
        sendEndedStateOnce()
      }
      isStartingWorkout = false
      isEnding = false
      timer?.invalidate()
      timer = nil
      session = nil
      builder = nil
    case .prepared:
      healthKitLabel = "HK: prepared"
    case .stopped:
      healthKitLabel = "HK: stopping"
    default:
      break
    }
  }

  fileprivate func handleWorkoutSessionFailure(_ error: Error) {
    if isDiscardingCurrentSession { discardSession = nil }
    StrideWatchStartTrail.mark("HK failure: \(error.localizedDescription)", terminal: true)
    clearStartWatchdog()
    isStartingWorkout = false
    healthKitLabel = "HK: error"
    abandonRoute()
    publishError(error.localizedDescription)
  }

  fileprivate func handleActivationCompleted(error: Error?) {
    pendingConnectivityActivationWorkItem?.cancel()
    pendingConnectivityActivationWorkItem = nil
    if let error {
      let shouldSuppress = suppressNextConnectivityActivationError
      suppressNextConnectivityActivationError = false
      if !shouldSuppress {
        publishError(error.localizedDescription)
      }
    } else {
      suppressNextConnectivityActivationError = false
    }
    refreshConnectivityLabel()
    flushQueuedOutboundPayloads()
    sendCapabilities()
  }

  fileprivate func noteCommand(_ type: String, via: String, result: String) {
    lastCommandReceivedAt = Date()
    lastCommandLabel = "Cmd: \(type) \(via) \(result)"
  }

  fileprivate func handlePhoneCommand(
    _ message: [String: Any],
    via: String,
    fromApplicationContext: Bool = false
  ) {
    let type = message["type"] as? String
    let commandWorkoutInstanceId = message["workoutInstanceId"] as? String ?? ""
    let sentAt: Double
    if let value = message["sentAt"] as? NSNumber {
      sentAt = value.doubleValue
    } else if let value = message["sentAt"] as? Double {
      sentAt = value
    } else {
      sentAt = 0
    }
    // sentAt is a millisecond timestamp (~1.8e12). It must never go through
    // Int: on 32-bit watches that conversion traps on every phone command.
    let safeSentAt = sentAt.isFinite && sentAt >= 0 && sentAt < Double(Int64.max)
    let sentAtKey = safeSentAt ? Int64(sentAt.rounded()) : 0
    let commandKey = "\(type ?? "")|\(commandWorkoutInstanceId)|\(sentAtKey)"
    onMain {
      guard let type else { return }
      self.refreshConnectivityLabel()
      if self.isStaleControlCommand(type: type, sentAt: sentAt, fromApplicationContext: fromApplicationContext) {
        self.noteCommand(type, via: via, result: "stale")
        return
      }
      // The same command normally arrives over several channels (message,
      // userInfo, applicationContext). Remember recent keys so replays and
      // late duplicates never restart or re-end a workout.
      if sentAt > 0 && self.handledPhoneCommandKeys.contains(commandKey) {
        self.noteCommand(type, via: via, result: "dup")
        return
      }
      // Only a live start (phone sent it while this app was open) may start
      // HealthKit. Starts queued while the app was closed are replayed on the
      // next launch; running them there turned one bad start into a crash on
      // every launch. The key is not recorded here, so the live copy of the
      // same start (which may arrive after its applicationContext copy) still
      // runs.
      let isStart = type == "startWorkout" || type == "startRun"
      if isStart && via != "msg" {
        self.noteCommand(type, via: via, result: "queued_start_ignored")
        self.sendCommandAck(command: type, message: message, reason: "queued_start_ignored")
        return
      }
      if sentAt > 0 {
        self.handledPhoneCommandKeys.append(commandKey)
        if self.handledPhoneCommandKeys.count > 40 {
          self.handledPhoneCommandKeys.removeFirst(self.handledPhoneCommandKeys.count - 40)
        }
      }

      switch type {
      case "requestCapabilities":
        self.sendCapabilities()
      case "startWorkout", "startRun":
        guard let kind: StrideWatchWorkoutKind = type == "startRun"
          ? .run : StrideWatchWorkoutKind.from(message["workoutKind"] as? String) else {
          self.sendCommandAck(command: type, message: message, reason: "unsupported_workout_kind")
          return
        }
        if self.adoptPhoneStartIfProvisional(message) {
          self.noteCommand(type, via: via, result: "adopted")
          self.sendCommandAck(command: type, message: message, reason: nil)
          break
        }
        StrideWatchStartTrail.mark("1 cmd \(type) live")
        let reason = self.startWorkout(
          kind: kind,
          title: message["title"] as? String,
          workoutInstanceId: message["workoutInstanceId"] as? String,
          environment: message["environment"] as? String,
          targetZone: message["targetZone"] as? Int
        )
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "pauseWorkout", "pauseRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.pauseWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "resumeWorkout", "resumeRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.resumeWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "endWorkout", "endRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.endWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "setContext":
        self.applyPhoneContext(message)
        self.noteCommand(type, via: via, result: "ok")
      default:
        break
      }
    }
  }

  private func sendCapabilities() {
    sendToPhone([
      "type": "capabilities", "protocolVersion": 2,
      "supportedWorkoutKinds": StrideWatchWorkoutKind.allCases.map { $0.rawValue },
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ])
  }

  /// nil when a pause/resume/end command applies to the current workout.
  private func controlRejection(_ message: [String: Any]) -> String? {
    guard isActive || session != nil else { return "no_active_workout" }
    if let requestedId = message["workoutInstanceId"] as? String, !requestedId.isEmpty,
      let currentId = workoutInstanceId, !currentId.isEmpty, requestedId != currentId
    {
      return "id_mismatch"
    }
    return nil
  }

  private func isStaleControlCommand(type: String?, sentAt: Double, fromApplicationContext: Bool = false) -> Bool {
    guard sentAt > 0, let type else { return false }
    let controlCommands = [
      "startWorkout",
      "startRun",
      "pauseWorkout",
      "pauseRun",
      "resumeWorkout",
      "resumeRun",
      "endWorkout",
      "endRun",
    ]
    guard controlCommands.contains(type) else { return false }
    let nowMs = Date().timeIntervalSince1970 * 1000
    let window = fromApplicationContext ? stalePhoneContextWindowMs : stalePhoneCommandWindowMs
    return nowMs - sentAt > window
  }

  private func applyPhoneContext(_ message: [String: Any]) {
    if let unitSystem = message["unitSystem"] as? String {
      preferredUnitSystem = unitSystem == "metric" ? "metric" : "imperial"
    }
    if let maxHeartRate = message["maxHeartRateBpm"] as? Int, maxHeartRate > 0 {
      maxHeartRateBpm = maxHeartRate
    }
    if let targetZone = message["targetZone"] as? Int {
      self.targetZone = targetZone
    }
  }

  var lastCommandAgeLabel: String? {
    guard let lastCommandReceivedAt else { return nil }
    let seconds = Int(Date().timeIntervalSince(lastCommandReceivedAt))
    return seconds < 60 ? "\(seconds)s ago" : "\(seconds / 60)m ago"
  }
}

extension StrideWatchWorkoutManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    if toState != .running {
      StrideWatchStartTrail.markIfStarting("15 HK state \(toState.rawValue)")
    }
    DispatchQueue.main.async {
      // A previous session can report .ended after a new workout has started;
      // it must not clear or end the current session.
      guard workoutSession === self.session else { return }
      self.handleWorkoutSessionStateChange(toState)
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    DispatchQueue.main.async {
      guard workoutSession === self.session else { return }
      self.handleWorkoutSessionFailure(error)
    }
  }
}

extension StrideWatchWorkoutManager: HKLiveWorkoutBuilderDelegate {
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    if
      let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate),
      collectedTypes.contains(heartRateType),
      let statistics = workoutBuilder.statistics(for: heartRateType),
      let quantity = statistics.mostRecentQuantity()
    {
      let value = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      guard value.isFinite, value > 0, value <= 1000 else { return }
      let bpm = Int(value.rounded())
      let observedAt = statistics.mostRecentQuantityDateInterval()?.end
      DispatchQueue.main.async {
        guard workoutBuilder === self.builder, self.state == .running, let observedAt else { return }
        self.heartRateBpm = bpm
        self.heartRateObservedAt = observedAt
        self.sendHeartRate(bpm)
      }
    }

    if
      let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
      collectedTypes.contains(energyType),
      let statistics = workoutBuilder.statistics(for: energyType),
      let quantity = statistics.sumQuantity()
    {
      let kilocalories = quantity.doubleValue(for: .kilocalorie())
      DispatchQueue.main.async {
        guard workoutBuilder === self.builder else { return }
        self.activeEnergyKilocalories = kilocalories
      }
    }

    DispatchQueue.main.async {
      guard
        workoutBuilder === self.builder,
        let distanceIdentifier = self.selectedWorkoutKind.distanceIdentifier,
        let distanceType = HKObjectType.quantityType(forIdentifier: distanceIdentifier),
        collectedTypes.contains(distanceType),
        let statistics = workoutBuilder.statistics(for: distanceType),
        let quantity = statistics.sumQuantity()
      else { return }
      self.distanceMeters = quantity.doubleValue(for: .meter())
    }

    if let cadenceType = HKObjectType.quantityType(forIdentifier: .cyclingCadence),
      collectedTypes.contains(cadenceType), let statistics = workoutBuilder.statistics(for: cadenceType),
      let quantity = statistics.mostRecentQuantity(), let observedAt = statistics.mostRecentQuantityDateInterval()?.end {
      let rpm = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      if rpm.isFinite, rpm >= 0 {
        DispatchQueue.main.async {
          guard workoutBuilder === self.builder, self.selectedWorkoutKind == .cycling, self.state == .running else { return }
          self.cyclingCadenceRpm = rpm
          self.cadenceObservedAt = observedAt
          self.sendTelemetry(["cadenceRpm": rpm], at: observedAt)
        }
      }
    }
    if let cyclingPower = HKObjectType.quantityType(forIdentifier: .cyclingPower),
      collectedTypes.contains(cyclingPower), let statistics = workoutBuilder.statistics(for: cyclingPower),
      let quantity = statistics.mostRecentQuantity(), let observedAt = statistics.mostRecentQuantityDateInterval()?.end {
      let watts = quantity.doubleValue(for: .watt())
      if watts.isFinite, watts >= 0 {
        DispatchQueue.main.async {
          guard workoutBuilder === self.builder, self.selectedWorkoutKind == .cycling, self.state == .running else { return }
          self.currentPowerWatts = watts
          self.powerObservedAt = observedAt
          self.sendTelemetry(["powerWatts": watts, "powerKind": "measured", "powerSport": "cycling"], at: observedAt)
        }
      }
    }
    if let powerType = HKObjectType.quantityType(forIdentifier: .runningPower),
      collectedTypes.contains(powerType), let statistics = workoutBuilder.statistics(for: powerType),
      let quantity = statistics.mostRecentQuantity(), let observedAt = statistics.mostRecentQuantityDateInterval()?.end {
      let watts = quantity.doubleValue(for: .watt())
      guard watts.isFinite, watts >= 0 else { return }
      DispatchQueue.main.async {
        guard workoutBuilder === self.builder, self.selectedWorkoutKind == .run, self.state == .running else { return }
        self.currentPowerWatts = watts
        self.powerObservedAt = observedAt
        self.sendTelemetry(["powerWatts": watts, "powerKind": "device_estimated", "powerSport": "running"], at: observedAt)
      }
    }
  }
}

extension StrideWatchWorkoutManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.handleActivationCompleted(error: error)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.refreshConnectivityLabel()
      self.flushQueuedOutboundPayloads()
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handlePhoneCommand(message, via: "msg")
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handlePhoneCommand(userInfo, via: "info")
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handlePhoneCommand(applicationContext, via: "ctx", fromApplicationContext: true)
  }

  func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
    DispatchQueue.main.async {
      self.pendingSyncCount = max(0, self.pendingSyncCount - 1)
      if let error {
        self.lastError = error.localizedDescription
      }
    }
  }
}

/// Records each step of a workout start synchronously to a small file so the
/// next launch can show exactly where a start died. A step marked terminal is
/// a clean outcome (running, failed, ended); a non-terminal last step means the
/// process was killed during it.
enum StrideWatchStartTrail {
  private static let fileURL: URL = {
    let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("stride-start-trail.txt")
  }()

  private static let lock = NSLock()
  private static var starting = false

  static func mark(_ step: String, terminal: Bool = false) {
    lock.lock()
    defer { lock.unlock() }
    starting = !terminal
    let line = "\(terminal ? "T" : "S")|\(Int64(Date().timeIntervalSince1970))|\(step)"
    try? Data(line.utf8).write(to: fileURL, options: .atomic)
  }

  /// Marks only while a start is in flight, so steady-state callbacks never
  /// overwrite the outcome of the last start.
  static func markIfStarting(_ step: String) {
    lock.lock()
    let isStarting = starting
    lock.unlock()
    if isStarting { mark(step) }
  }

  static func read() -> (step: String, terminal: Bool, at: Date)? {
    guard let text = try? String(contentsOf: fileURL, encoding: .utf8) else { return nil }
    let parts = text.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false)
    guard parts.count == 3, let seconds = TimeInterval(parts[1]) else { return nil }
    return (String(parts[2]), parts[0] == "T", Date(timeIntervalSince1970: seconds))
  }

  /// Captures Objective-C exceptions (HealthKit raises these for invalid use)
  /// with the step they happened in. Swift traps cannot be caught; for those
  /// the last non-terminal step is the evidence.
  static func installExceptionHandler() {
    NSSetUncaughtExceptionHandler { exception in
      let previous = StrideWatchStartTrail.read()?.step ?? "no step"
      let reason = String((exception.reason ?? "").prefix(160))
      StrideWatchStartTrail.mark("EXC \(exception.name.rawValue) during [\(previous)]: \(reason)")
    }
  }
}


extension StrideWatchWorkoutManager: CLLocationManagerDelegate {
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    // Accurate fixes only; the route is a map, not a distance source.
    let usable = locations.filter { $0.horizontalAccuracy > 0 && $0.horizontalAccuracy <= 50 }
    guard !usable.isEmpty else { return }
    DispatchQueue.main.async {
      guard self.state == .running else { return }
      if self.selectedWorkoutKind == .crossCountrySkiing {
        for location in usable where location.horizontalAccuracy <= 20 {
          defer { self.xcDistanceAnchor = location }
          guard let previous = self.xcDistanceAnchor else { continue }
          let seconds = location.timestamp.timeIntervalSince(previous.timestamp)
          let meters = location.distance(from: previous)
          guard seconds > 0, seconds <= 15, meters.isFinite, meters / seconds <= 16, meters >= 2.5 else { continue }
          self.distanceMeters += meters
        }
      }
      self.routeBuilder?.insertRouteData(usable) { _, _ in }
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
