// ─── Movement Lab Types ─────────────────────────────────────────────────────
//
// Architecture: All analysis is manual today. Future AI hooks are documented
// with "AI INTEGRATION HOOK" comments where computer vision / pose estimation
// would plug in (MediaPipe, MoveNet, OpenPose, vGait-style 3D pipelines).
//
// Phone video analysis is 2D and estimated. These types are NOT diagnostic —
// they are for coaching, education, and trend tracking only.

// ─── Enums / union types ─────────────────────────────────────────────────────

export type MovementAnalysisType =
  | 'running_gait'
  | 'lifting_mechanics'
  | 'mobility'
  | 'other';

export type MovementViewAngle =
  | 'side'
  | 'front'
  | 'rear'
  | '45_degree'
  | 'unknown';

export type MovementActivity =
  | 'running'
  | 'walking'
  | 'squat'
  | 'deadlift'
  | 'lunge'
  | 'step_down'
  | 'jump'
  | 'press'
  | 'pull'
  | 'calf_raise'
  | 'other';

export type BodySide = 'left' | 'right' | 'bilateral';

export type FindingSeverity   = 'low' | 'moderate' | 'high';
export type FindingConfidence = 'high' | 'moderate' | 'low';

// ─── Video record ─────────────────────────────────────────────────────────────
//
// Stores the URI reference only — actual binary video stays in the device
// camera roll / filesystem. On web builds, the URI may be an object URL.

export type MovementVideo = {
  id:           string;
  uri:          string;            // local URI or asset reference
  title:        string;
  date:         string;            // "YYYY-MM-DD"
  analysisType: MovementAnalysisType;
  view:         MovementViewAngle;
  activity:     MovementActivity;
  shoes?:       string;
  surface?:     string;
  paceSecPerMi?: number;           // for running videos
  loadKg?:      number;            // for lifting videos
  notes?:       string;
  painNotes?:   string;
  durationSec?: number;
  storagePath?:          string;   // Supabase Storage path for the video file
  submittedForAnalysis?: boolean;
  analysisStatus?:       'pending' | 'in_review' | 'complete' | null;
  analysisRequestId?:    string;
  createdAt:    number;            // Date.now()
};

// ─── Gait joint types ─────────────────────────────────────────────────────────

export type GaitJoint =
  | 'trunk'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'pelvis'
  | 'shoulder'
  | 'elbow';

export type GaitAngleName =
  | 'trunk_lean'
  | 'hip_flexion'
  | 'hip_extension'
  | 'knee_flexion'
  | 'ankle_dorsiflexion'
  | 'ankle_plantarflexion'
  | 'foot_progression'
  | 'pelvic_drop';

// ─── Lifting joint types ──────────────────────────────────────────────────────

export type LiftingJoint =
  | 'trunk'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'neck';

export type LiftingAngleName =
  | 'trunk_angle'
  | 'hip_angle'
  | 'knee_angle'
  | 'ankle_angle'
  | 'shoulder_angle'
  | 'elbow_angle'
  | 'wrist_angle';

// ─── Joint angle estimate ─────────────────────────────────────────────────────
//
// Manually measured from video frame. Angles are estimated to ±10°.
// Disclaimer: not lab-grade. Intended for trend tracking only.

export type JointAngleEstimate = {
  id:           string;
  videoId:      string;
  angleName:    GaitAngleName | LiftingAngleName | string;
  joint:        GaitJoint | LiftingJoint;
  side:         BodySide;
  angleDegrees: number;           // measured angle in degrees
  frameNote?:   string;           // "initial contact", "mid-stance", "lockout"
  view:         MovementViewAngle;
  confidence:   FindingConfidence;
  notes?:       string;
  createdAt:    number;
};

// ─── Gait analysis fields ─────────────────────────────────────────────────────
//
// Manual checklist fields for running gait analysis.

export type FootStrikePattern = 'heel' | 'midfoot' | 'forefoot' | 'unknown';
export type GaitSymmetry      = 'symmetric' | 'mildly_asymmetric' | 'moderately_asymmetric' | 'severely_asymmetric' | 'unknown';
export type OscillationLevel  = 'low' | 'moderate' | 'high' | 'unknown';
export type TrunkPosition     = 'forward' | 'neutral' | 'backward' | 'unknown';
export type SeverityOrNull    = 'none' | 'mild' | 'moderate' | 'severe' | null;
export type ArmSwingQuality   = 'restricted' | 'good' | 'excessive' | 'asymmetric' | 'unknown';

export type GaitAnalysis = {
  videoId:              string;
  cadence?:             number;           // steps/min
  stepRate?:            number;           // same as cadence but sometimes distinguished
  strideLengthEst?:     number;           // meters (estimated from video)
  strideTimeEst?:       number;           // seconds per stride (estimated)
  stanceSwingEst?:      string;           // e.g. "60/40" stance/swing %
  footStrike:           FootStrikePattern;
  overstride:           boolean | null;
  crossoverGait:        boolean | null;
  verticalOscillation:  OscillationLevel;
  trunkLean:            TrunkPosition;
  hipDrop:              SeverityOrNull;
  pelvicControl:        SeverityOrNull;
  kneeValgus:           SeverityOrNull;
  footProgressionAngle?: number;          // degrees (positive = toe-out)
  armSwing:             ArmSwingQuality;
  symmetry:             GaitSymmetry;
  painLocation?:        string;
  fatigueState?:        'fresh' | 'moderate_fatigue' | 'high_fatigue' | 'unknown';
  additionalNotes?:     string;
};

// ─── Lifting analysis fields ──────────────────────────────────────────────────

export type DepthQuality   = 'quarter' | 'half' | 'parallel' | 'full' | 'atg' | 'unknown';
export type HipStrategy    = 'hip_dominant' | 'knee_dominant' | 'balanced' | 'unknown';
export type BarPathQuality = 'vertical' | 'slight_arc' | 'excessive_drift' | 'unknown';

export type LiftingAnalysis = {
  videoId:             string;
  exercise:            string;            // e.g. "Back Squat", "Romanian Deadlift"
  loadKg?:             number;
  reps?:               number;
  setNumber?:          number;
  tempo?:              string;            // e.g. "3-1-1-0"
  depth:               DepthQuality;
  trunkPosition?:      string;           // free text observation
  hipStrategy:         HipStrategy;
  kneeValgus:          SeverityOrNull;
  footPressureNotes?:  string;
  spinalPositionNotes?: string;
  barPath:             BarPathQuality;
  shoulderMechanics?:  string;
  asymmetry:           GaitSymmetry;
  painNotes?:          string;
  additionalNotes?:    string;
};

// ─── Gait finding ─────────────────────────────────────────────────────────────

export type GaitFinding = {
  id:             string;
  videoId:        string;
  finding:        string;             // e.g. "Overstriding at midfoot contact"
  severity:       FindingSeverity;
  confidence:     FindingConfidence;
  implication?:   string;            // "Increases braking force, shin stress"
  drill?:         string;            // "A-skips, quick cadence drills"
  strengthFocus?: string;            // "Glute strength, hip extension"
  retestNote?:    string;
  createdAt:      number;
};

// ─── Lifting finding ──────────────────────────────────────────────────────────

export type LiftingFinding = {
  id:           string;
  videoId:      string;
  exercise:     string;
  finding:      string;
  severity:     FindingSeverity;
  confidence:   FindingConfidence;
  implication?: string;
  regression?:  string;            // "Box squat to parallel, goblet squat"
  progression?: string;            // "Add tempo, increase load 5%"
  cue?:         string;            // "Chest up, knees track toes"
  retestNote?:  string;
  createdAt:    number;
};

// ─── Movement risk flag ───────────────────────────────────────────────────────
//
// Flags are generated from findings. They propagate into the performance scoring
// system and can influence training recommendations.

export type MovementRiskFlagType =
  | 'strength_deficit'
  | 'form_fault'
  | 'asymmetry'
  | 'gait_fault'
  | 'mobility_deficit';

export type MovementScoreKey =
  | 'movement_capacity'
  | 'durability'
  | 'running_economy';

export type MovementRiskFlag = {
  id:            string;
  videoId:       string;
  sourceFinding: string;         // the finding text that triggered this flag
  type:          MovementRiskFlagType;
  severity:      FindingSeverity;
  affectsScores: MovementScoreKey[];
  suggestion:    string;         // actionable coaching suggestion
  active:        boolean;        // dismissable by user
  createdAt:     number;
};

// ─── Movement analysis session ────────────────────────────────────────────────
//
// One session per video. Created on first finding entry. Manual-only for now.

export type MovementAnalysisSession = {
  id:              string;
  videoId:         string;
  createdAt:       number;
  updatedAt:       number;
  analyst:         'manual' | 'ai_assisted';  // always 'manual' today
  gaitAnalysis?:   GaitAnalysis;
  liftingAnalysis?: LiftingAnalysis;
  gaitFindings:    GaitFinding[];
  liftingFindings: LiftingFinding[];
  jointAngles:     JointAngleEstimate[];
  riskFlags:       MovementRiskFlag[];

  // ── AI INTEGRATION HOOK ────────────────────────────────────────────────────
  // Future: MediaPipe/MoveNet/OpenPose would populate poseKeypoints per frame.
  // Future: vGait-style 3D pipeline would add z-coordinates and joint moments.
  // Future: Gait event detection (initial contact, toe-off) populates gaitEvents.
  // Future: Joint angle calculations become automatic from keypoints.
  // Future: Asymmetry scoring becomes automatic from bilateral keypoints.
  poseKeypoints?:   PoseKeypoint[];
  gaitEvents?:      GaitEvent[];
  gaitMetrics?:     GaitMetric[];
  frameAnnotations?: VideoFrameAnnotation[];
};

// ─── Future AI types ──────────────────────────────────────────────────────────
//
// These types define the contracts for future computer vision integration.
// No AI APIs are called today. All fields remain optional/unused until integrated.

// AI INTEGRATION HOOK: MediaPipe/MoveNet pose keypoints (one per landmark per frame).
export type PoseKeypoint = {
  name:       string;      // e.g. "left_knee", "right_hip", "nose"
  x:          number;      // normalized 0–1 (width)
  y:          number;      // normalized 0–1 (height)
  z?:         number;      // depth — 3D systems only (vGait / OpenPose 3D)
  confidence: number;      // 0–1 model confidence
  frameIndex: number;      // video frame number
};

// AI INTEGRATION HOOK: Gait event detection — initial contact, toe-off, mid-stance, etc.
export type GaitEventType =
  | 'initial_contact'
  | 'toe_off'
  | 'mid_stance'
  | 'terminal_stance'
  | 'peak_swing';

export type GaitEvent = {
  type:       GaitEventType;
  side:       BodySide;
  frameIndex: number;
  timeMs:     number;
};

// AI INTEGRATION HOOK: Computed stride metrics from gait events.
export type GaitMetric = {
  name:   string;     // "cadence", "stride_length", "contact_time", "flight_time"
  value:  number;
  unit:   string;
  side?:  BodySide;
};

// AI INTEGRATION HOOK: Frame-level overlay annotations (rendered by a future vision layer).
export type VideoFrameAnnotation = {
  frameIndex: number;
  type:       'keypoint_overlay' | 'angle_label' | 'event_marker' | 'risk_zone';
  label?:     string;
  color?:     string;
  data?:      Record<string, number | string>;
};

// ─── Movement Lab V1.5 — markerless still analysis ────────────────────────────
//
// One MovementAnalysis per analyzed still (photo or extracted video frame).
// Landmarks come from on-device Apple Vision pose detection (stride-pose).
// All fields are honest: undefined landmarks = pose never ran / unavailable.

export type MovementAnalysisKind = 'running_gait' | 'squat' | 'deadlift' | 'lunge_single_leg' | 'general';
export type AnalysisMediaType = 'photo' | 'video_frame' | 'video';
export type AnalysisConfidence = 'high' | 'moderate' | 'low' | 'manual_review';
export type MovementLandmarkSource = 'auto' | 'user_corrected' | 'manual_review';
export type PoseLandmarkRecord = { name: string; x: number; y: number; confidence: number };
export type EstimatedAngle = { name: string; joint: string; side: 'left' | 'right' | 'center'; degrees: number; confidence: number; note?: string };
export type ChecklistFinding = { itemId: string; label: string; value: string; severity?: FindingSeverity; note?: string };
export type AnalysisRecommendation = {
  finding: string;
  meaning: string;
  confidence?: FindingConfidence;
  recommendation: string;
};
export type MovementAnalysis = {
  id: string; createdAt: number; updatedAt: number;
  type: MovementAnalysisKind;
  mediaUri: string;               // the analyzed still (photo or extracted frame)
  sourceVideoUri?: string;        // original video when mediaType === 'video_frame'
  mediaType: AnalysisMediaType;
  cameraView: MovementViewAngle;
  landmarks?: PoseLandmarkRecord[];   // undefined = pose not run/unavailable
  imageAspectRatio?: number;          // width/height of analyzed image
  estimatedAngles?: EstimatedAngle[];
  autoLandmarks?: PoseLandmarkRecord[];
  correctedLandmarks?: PoseLandmarkRecord[];
  landmarkSource?: MovementLandmarkSource;
  checklistFindings: ChecklistFinding[];
  confidence: AnalysisConfidence;
  notes?: string;
  recommendations: AnalysisRecommendation[];
  limitations: string[];
  linkedWorkoutId?: string; linkedRunId?: string;
  status: 'draft' | 'complete' | 'needs_review';
  referenceFrameTimeMs?: number;
  referenceFrameUri?: string;

  // ── Movement Lab V2 — video sequence analysis (all optional, see below) ────
  poseSequenceUri?:     string;             // full frame-by-frame landmarks file (see poseSequenceStorage)
  angleSeries?:         AngleSeries[];      // smoothed + downsampled, inline
  keyFrames?:           KeyFrameRecord[];   // inline landmarks so detail screens work offline
  repSummaries?:        RepSummary[];       // strength kinds only
  symmetryEstimates?:   SequenceSymmetryEstimate[]; // gait kinds only
  sequenceConfidence?:  AnalysisConfidence;
  sequenceLimitations?: string[];
  analyzedDurationMs?:  number;
  videoDurationMs?:     number;
};

// ─── Movement Lab V2 — video sequence analysis ────────────────────────────────
//
// Frame-by-frame joint-angle tracking over a full recorded video clip, built
// on top of the same 2D Apple Vision landmarks as V1.5. Same honesty rules:
// a missing angle means the contributing landmarks weren't confidently
// detected that frame — never interpolated/guessed silently (see
// src/utils/poseSequence.ts). Full per-frame raw landmarks are file-backed
// (movement-pose/<analysisId>.json); only smoothed/downsampled series and
// key frames are kept inline on MovementAnalysis so persisted state (and
// AsyncStorage rehydrate) stays small.

/** One sample in an angle-over-time series. `degrees: null` is an honest gap — the
 *  contributing landmarks weren't confidently detected in that frame, never guessed. */
export type AngleSeriesPoint = {
  timeMs:     number;
  degrees:    number | null;
  confidence: number;   // 0 when degrees is null
};

export type AngleSeries = {
  name:   string;                          // e.g. "Knee flexion"
  joint:  string;                          // e.g. "knee"
  side:   'left' | 'right' | 'center';
  points: AngleSeriesPoint[];
};

/** A single labeled moment in the clip, with an inline landmark/angle snapshot
 *  so the Key Frames tab and skeleton overlay work without loading the full
 *  per-frame pose file. */
export type KeyFrameRecord = {
  id:         string;
  label:      string;    // e.g. "Setup", "Deepest position", "Estimated contact (approximate) — left"
  timeMs:     number;
  landmarks?: PoseLandmarkRecord[];
  angles?:    EstimatedAngle[];
};

/** One detected rep for strength kinds (squat / deadlift / lunge_single_leg).
 *  Rep segmentation is threshold-crossing on smoothed knee-flexion — an
 *  estimate, not a force-plate or barbell-tracking measurement. */
export type RepSummary = {
  index:              number;   // 0-based
  startMs:            number;
  bottomMs:           number;
  endMs:              number;
  durationMs:         number;
  peakFlexionDeg:     number;
  hipAngleAtBottom?:   number;
  trunkAngleAtBottom?: number;
};

/** Left vs right comparison over the clip (gait kinds). Differences under
 *  ~10-15% are described as within measurement noise for 2D single-camera
 *  video, never presented as a clinical asymmetry finding. */
export type SequenceSymmetryEstimate = {
  metric:      string;    // e.g. "Knee flexion range"
  leftValue:   number;
  rightValue:  number;
  ratio:       number;    // smaller / larger, 0..1
  withinNoise: boolean;
  note:        string;
};
