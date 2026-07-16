// ─── Pose Sequence ─────────────────────────────────────────────────────────────
//
// Pure functions over a StridePose.detectPoseSequence() result: build per-frame
// angle series (reusing poseAngles.computeEstimatedAngles), smooth them,
// detect reps / key moments, and rate overall detection confidence. No I/O —
// callers handle persistence (src/lib/poseSequenceStorage.ts).
//
// Honesty rules carried over from V1.5 (see docs/movement-tracking-research.md):
// - A missing angle is a gap (`degrees: null`), never interpolated or guessed.
// - Gait events (contact/toe-off) and rep boundaries are *estimates* derived
//   from 2D landmark kinematics — always labeled as such in the UI.
// - No foot landmarks → no footstrike, no ankle dorsi/plantarflexion.

import type { PoseJoint, PoseSequenceResult } from 'stride-pose';
import { computeEstimatedAngles, computeFrontalMetrics, LANDMARK_CONFIDENCE_FLOOR } from './poseAngles';
import { filterAngleSeries, filterEstimatedAngles, filterLandmarksForDisplay } from './measurementMatrix';
import type {
  AngleSeries,
  AngleSeriesPoint,
  AnalysisConfidence,
  EstimatedAngle,
  KeyFrameRecord,
  MovementAnalysisKind,
  MovementViewAngle,
  PoseLandmarkRecord,
  RepSummary,
  SequenceSymmetryEstimate,
} from '../types/movement';

// ─── Small numeric helpers ──────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

let keyFrameSeq = 0;
function keyFrameId(): string {
  keyFrameSeq += 1;
  return `kf_${Date.now()}_${keyFrameSeq}`;
}

// ─── View-aware per-frame angles ────────────────────────────────────────────────

/** True for a front/rear capture, where sagittal angles are unreliable and the
 *  frontal-plane metrics (pelvic obliquity, frontal knee position, trunk lateral
 *  lean) are the meaningful estimates instead. */
function isFrontalView(view: MovementViewAngle): boolean {
  return view === 'front' || view === 'rear';
}

/** The estimated angles for one frame, chosen by camera view: frontal metrics
 *  for a front/rear clip, the existing sagittal set otherwise. */
function frameAnglesForView(joints: PoseJoint[], kind: MovementAnalysisKind, view: MovementViewAngle): EstimatedAngle[] {
  return isFrontalView(view)
    ? computeFrontalMetrics(joints)
    : computeEstimatedAngles(joints, kind, { view });
}

// ─── buildAngleSeries ───────────────────────────────────────────────────────────

/**
 * Runs the view-appropriate per-frame angle computation and reassembles the
 * results into one series per (side, angle name). Frontal/posterior views emit
 * the frontal-plane metric series; lateral/unknown views emit the sagittal set.
 * Frames where a metric couldn't be computed (missing/low-confidence landmarks)
 * become an honest gap (`degrees: null`) rather than being dropped or interpolated.
 */
export function buildAngleSeries(
  result: PoseSequenceResult,
  kind:   MovementAnalysisKind,
  view:   MovementViewAngle = 'unknown',
): AngleSeries[] {
  const perFrame = result.frames.map(f => ({
    timeMs: f.timeMs,
    angles: f.joints.length > 0 ? frameAnglesForView(f.joints as PoseJoint[], kind, view) : [],
  }));

  type Meta = {
    name: string;
    joint: string;
    side: 'left' | 'right' | 'center';
    metricId?: EstimatedAngle['metricId'];
    motion?: EstimatedAngle['motion'];
  };
  const metaByKey = new Map<string, Meta>();
  for (const frame of perFrame) {
    for (const a of frame.angles) {
      const key = `${a.side}::${a.name}`;
      if (!metaByKey.has(key)) {
        metaByKey.set(key, {
          name: a.name,
          joint: a.joint,
          side: a.side,
          metricId: a.metricId,
          motion: a.motion,
        });
      }
    }
  }

  const sideOrder: Record<Meta['side'], number> = { left: 0, right: 1, center: 2 };
  const series: AngleSeries[] = [...metaByKey.entries()]
    .sort(([, a], [, b]) => sideOrder[a.side] - sideOrder[b.side] || a.name.localeCompare(b.name))
    .map(([, meta]) => {
      const points: AngleSeriesPoint[] = perFrame.map(frame => {
        const match = frame.angles.find(a => a.side === meta.side && a.name === meta.name);
        return match
          ? { timeMs: frame.timeMs, degrees: match.degrees, confidence: match.confidence }
          : { timeMs: frame.timeMs, degrees: null, confidence: 0 };
      });
      return {
        name: meta.name,
        joint: meta.joint,
        side: meta.side,
        points,
        metricId: meta.metricId,
        motion: meta.motion,
      };
    });

  return series;
}

// ─── smoothAngleSeries ──────────────────────────────────────────────────────────

/**
 * Centered moving average, window ~5 samples, applied only within contiguous
 * runs of real data — a gap (`degrees: null`) is never smoothed across or
 * filled in, and stays a gap in the output.
 */
export function smoothAngleSeries(series: AngleSeries[], window = 5): AngleSeries[] {
  const half = Math.max(1, Math.floor(window / 2));
  return series.map(s => {
    const points = s.points;
    const smoothed: AngleSeriesPoint[] = points.map((p, i) => {
      if (p.degrees === null) return p;
      let lo = i;
      let hi = i;
      while (lo > 0 && points[lo - 1].degrees !== null && i - lo < half) lo -= 1;
      while (hi < points.length - 1 && points[hi + 1].degrees !== null && hi - i < half) hi += 1;
      const windowPoints = points.slice(lo, hi + 1).filter(w => w.degrees !== null);
      const meanDeg = windowPoints.reduce((sum, w) => sum + (w.degrees as number), 0) / windowPoints.length;
      const meanConf = windowPoints.reduce((sum, w) => sum + w.confidence, 0) / windowPoints.length;
      return { timeMs: p.timeMs, degrees: round1(meanDeg), confidence: round2(meanConf) };
    });
    return { ...s, points: smoothed };
  });
}

// ─── decimateAngleSeries ────────────────────────────────────────────────────────

/** Evenly decimates each series to at most `maxPoints` samples, for inline
 *  storage on MovementAnalysis (full-resolution data stays file-backed). */
export function decimateAngleSeries(series: AngleSeries[], maxPoints = 240): AngleSeries[] {
  return series.map(s => {
    if (s.points.length <= maxPoints) return s;
    const step = s.points.length / maxPoints;
    const points: AngleSeriesPoint[] = [];
    for (let i = 0; i < maxPoints; i += 1) {
      points.push(s.points[Math.min(s.points.length - 1, Math.floor(i * step))]);
    }
    return { ...s, points };
  });
}

// ─── computeSequenceConfidence ──────────────────────────────────────────────────

/** Coverage (fraction of frames with a confidently-detected person) + mean
 *  landmark confidence on those frames, classified in the spirit of
 *  poseAngles.classifyPoseConfidence. */
export function computeSequenceConfidence(result: PoseSequenceResult): AnalysisConfidence {
  const total = result.frames.length;
  if (total === 0) return 'manual_review';

  const withJoints = result.frames.filter(f => f.joints.length > 0);
  const coverage = withJoints.length / total;
  if (coverage === 0) return 'manual_review';

  const meanConfidence = withJoints.reduce((sum, f) => {
    const frameMean = f.joints.reduce((s, j) => s + j.confidence, 0) / f.joints.length;
    return sum + frameMean;
  }, 0) / withJoints.length;

  if (coverage >= 0.8 && meanConfidence >= 0.75) return 'high';
  if (coverage >= 0.6 && meanConfidence >= 0.5)  return 'moderate';
  if (coverage >= 0.3) return 'low';
  return 'manual_review';
}

// ─── buildSequenceLimitations ───────────────────────────────────────────────────

export function buildSequenceLimitations(kind: MovementAnalysisKind, view: MovementViewAngle): string[] {
  const limitations: string[] = [
    'No foot/toe/heel landmarks — ankle dorsi/plantarflexion and footstrike pattern are not estimated.',
    '2D projection from a single camera — every angle is an estimate, not an exact clinical measurement.',
    'Each frame is detected independently — rep boundaries and gait events are estimated from motion, never measured directly.',
  ];
  if (view === 'front' || view === 'rear') {
    limitations.push('Front/rear view: sagittal-plane angles (knee flexion, hip angle, trunk lean) are unreliable from this camera angle — a side view is needed for those.');
  } else if (view === 'unknown') {
    limitations.push('Camera view was not specified, so angle reliability could not be checked against the expected view.');
  }
  if (kind === 'running_gait') {
    limitations.push('Contact/stance moments are approximate, derived from ankle vertical position — not measured ground-contact events.');
  }
  if (kind === 'bike_fit') {
    limitations.push('Top and bottom pedal phases are estimated from the visible closest-side knee cycle and require manual confirmation.');
    limitations.push('The bicycle, crank, pedals, saddle, cleats, and contact pressures are not tracked, so exact geometry and fit prescriptions are not available.');
    limitations.push('This lateral phone-video review does not replace an in-person bike fit and cannot determine force, joint loading, diagnosis, or injury risk.');
  }
  return limitations;
}

// ─── Shared series lookups ──────────────────────────────────────────────────────

function findSeries(series: AngleSeries[], name: string, side: AngleSeries['side']): AngleSeries | undefined {
  return series.find(s => s.name === name && s.side === side);
}

function seriesRange(s: AngleSeries | undefined): number {
  if (!s) return 0;
  const vals = s.points.map(p => p.degrees).filter((d): d is number => d !== null);
  return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
}

function nearestValue(s: AngleSeries | undefined, timeMs: number): number | undefined {
  if (!s || s.points.length === 0) return undefined;
  let best: AngleSeriesPoint | undefined;
  let bestDiff = Infinity;
  for (const p of s.points) {
    if (p.degrees === null) continue;
    const diff = Math.abs(p.timeMs - timeMs);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best?.degrees ?? undefined;
}

/** Average of left/right nearest-value at a timestamp, when both exist. */
function nearestBilateral(series: AngleSeries[], name: string, timeMs: number): number | undefined {
  const l = nearestValue(findSeries(series, name, 'left'), timeMs);
  const r = nearestValue(findSeries(series, name, 'right'), timeMs);
  if (l !== undefined && r !== undefined) return round1((l + r) / 2);
  return l ?? r;
}

function nearestHipMotion(
  series: AngleSeries[],
  side: 'left' | 'right',
  timeMs: number,
): RepSummary['hipMotionAtBottom'] {
  const flexion = nearestValue(findSeries(series, 'Hip flexion', side), timeMs);
  const extension = nearestValue(findSeries(series, 'Hip extension', side), timeMs);
  if (flexion === undefined && extension === undefined) return undefined;
  if (extension !== undefined && (flexion === undefined || extension > flexion)) {
    return { name: 'Hip extension', degrees: extension };
  }
  return { name: 'Hip flexion', degrees: flexion as number };
}

function frameLandmarks(result: PoseSequenceResult, timeMs: number): PoseLandmarkRecord[] | undefined {
  const frame = result.frames.find(f => f.timeMs === timeMs);
  return frame && frame.joints.length > 0
    ? frame.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence }))
    : undefined;
}

function frameAngles(result: PoseSequenceResult, kind: MovementAnalysisKind, timeMs: number, view: MovementViewAngle): EstimatedAngle[] | undefined {
  const frame = result.frames.find(f => f.timeMs === timeMs);
  return frame && frame.joints.length > 0 ? frameAnglesForView(frame.joints as PoseJoint[], kind, view) : undefined;
}

// ─── Rep segmentation (squat / deadlift / lunge / single_leg_control) ────────────

const MIN_CYCLE_MS  = 800;   // reject jitter faster than this
const MIN_DEPTH_DEG = 15;    // minimum peak-baseline delta to count as a rep

/** Combines left/right knee-flexion into one primary series for rep
 *  segmentation, preferring whichever side shows more range of motion
 *  (the working/visible leg for single-leg movements). */
function primaryKneeFlexionSeries(
  series: AngleSeries[],
  closestSide?: 'left' | 'right',
): { timeMs: number; value: number }[] {
  if (closestSide) {
    const selected = findSeries(series, 'Knee flexion', closestSide);
    return (selected?.points ?? [])
      .filter((point): point is AngleSeriesPoint & { degrees: number } => point.degrees !== null)
      .map(point => ({ timeMs: point.timeMs, value: point.degrees }));
  }
  const left  = findSeries(series, 'Knee flexion', 'left');
  const right = findSeries(series, 'Knee flexion', 'right');
  if (!left && !right) return [];

  const leftRange  = seriesRange(left);
  const rightRange = seriesRange(right);

  const times = new Set<number>();
  (left?.points ?? []).forEach(p => times.add(p.timeMs));
  (right?.points ?? []).forEach(p => times.add(p.timeMs));

  const out: { timeMs: number; value: number }[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const lp = left?.points.find(p => p.timeMs === t)?.degrees ?? null;
    const rp = right?.points.find(p => p.timeMs === t)?.degrees ?? null;
    let value: number | null;
    if (lp !== null && rp !== null) {
      value = Math.abs(leftRange - rightRange) < 5 ? (lp + rp) / 2 : (leftRange >= rightRange ? lp : rp);
    } else {
      value = lp ?? rp;
    }
    if (value !== null) out.push({ timeMs: t, value });
  }
  return out;
}

function detectReps(primary: { timeMs: number; value: number }[]): Omit<RepSummary, 'hipAngleAtBottom' | 'trunkAngleAtBottom'>[] {
  if (primary.length < 5) return [];

  const values = primary.map(p => p.value);
  const baseline = percentile(values, 0.1);
  const peak     = percentile(values, 0.95);
  if (peak - baseline < MIN_DEPTH_DEG) return [];
  const threshold = (baseline + peak) / 2;

  const reps: Omit<RepSummary, 'hipAngleAtBottom' | 'trunkAngleAtBottom'>[] = [];
  let inRep = false;
  let startMs = 0;
  let bottomMs = 0;
  let bottomVal = -Infinity;
  let lastRepStart = -Infinity;

  for (const { timeMs, value } of primary) {
    if (!inRep && value >= threshold) {
      if (timeMs - lastRepStart >= MIN_CYCLE_MS) {
        inRep = true;
        startMs = timeMs;
        bottomMs = timeMs;
        bottomVal = value;
      }
    } else if (inRep) {
      if (value > bottomVal) {
        bottomVal = value;
        bottomMs = timeMs;
      }
      if (value < threshold) {
        const endMs = timeMs;
        const durationMs = endMs - startMs;
        if (durationMs >= MIN_CYCLE_MS && bottomVal - baseline >= MIN_DEPTH_DEG) {
          reps.push({
            index: reps.length,
            startMs,
            bottomMs,
            endMs,
            durationMs,
            peakFlexionDeg: round1(bottomVal),
          });
          lastRepStart = startMs;
        }
        inRep = false;
      }
    }
  }
  return reps;
}

/** Spread (max − min) of peak depth across detected reps — a simple
 *  rep-to-rep consistency score. Undefined when fewer than 2 reps. */
export function repConsistency(reps: RepSummary[]): number | undefined {
  if (reps.length < 2) return undefined;
  const depths = reps.map(r => r.peakFlexionDeg);
  return round1(Math.max(...depths) - Math.min(...depths));
}

// ─── Gait key moments ────────────────────────────────────────────────────────

function findLocalMaxima(
  points: { timeMs: number; value: number }[],
  minSeparationMs: number,
): { timeMs: number; value: number }[] {
  const peaks: { timeMs: number; value: number }[] = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur  = points[i];
    const next = points[i + 1];
    if (cur.value >= prev.value && cur.value >= next.value) {
      const last = peaks[peaks.length - 1];
      if (!last || cur.timeMs - last.timeMs >= minSeparationMs) {
        peaks.push(cur);
      } else if (cur.value > last.value) {
        peaks[peaks.length - 1] = cur;
      }
    }
  }
  return peaks;
}

/** Raw (unsmoothed) ankle-y series for one side, straight from landmarks —
 *  used for estimated contact moments, which are a position signal, not an
 *  angle. Screen coords are top-left origin, so larger y = lower in frame. */
function ankleYSeries(result: PoseSequenceResult, side: 'left' | 'right'): { timeMs: number; value: number }[] {
  const jointName = `${side}_ankle`;
  const out: { timeMs: number; value: number }[] = [];
  for (const frame of result.frames) {
    const joint = frame.joints.find(j => j.name === jointName && j.confidence >= LANDMARK_CONFIDENCE_FLOOR);
    if (joint) out.push({ timeMs: frame.timeMs, value: joint.y });
  }
  return out;
}

/** Left vs right smoothed knee-flexion range comparison. Differences under
 *  ~15% are described as within measurement noise, never as an asymmetry
 *  finding on their own. */
export function buildSymmetryEstimate(smoothedSeries: AngleSeries[]): SequenceSymmetryEstimate | null {
  const left  = findSeries(smoothedSeries, 'Knee flexion', 'left');
  const right = findSeries(smoothedSeries, 'Knee flexion', 'right');
  if (!left || !right) return null;

  const leftVals  = left.points.map(p => p.degrees).filter((d): d is number => d !== null);
  const rightVals = right.points.map(p => p.degrees).filter((d): d is number => d !== null);
  if (leftVals.length < 3 || rightVals.length < 3) return null;

  const leftRange  = Math.max(...leftVals) - Math.min(...leftVals);
  const rightRange = Math.max(...rightVals) - Math.min(...rightVals);
  const larger  = Math.max(leftRange, rightRange);
  const smaller = Math.min(leftRange, rightRange);
  if (larger === 0) return null;

  const ratio      = smaller / larger;
  const diffPct    = Math.round((1 - ratio) * 100);
  const withinNoise = diffPct < 15;

  return {
    metric:      'Knee flexion range',
    leftValue:   round1(leftRange),
    rightValue:  round1(rightRange),
    ratio:       round2(ratio),
    withinNoise,
    note: withinNoise
      ? `Left/right knee-flexion range differ by about ${diffPct}% — within typical measurement noise for single-camera 2D video, not a meaningful asymmetry.`
      : `Left/right knee-flexion range differ by about ${diffPct}% over this clip. This is a rough estimate from one camera angle, not a diagnosis — consider a follow-up side-view clip per leg.`,
  };
}

// ─── detectKeyMoments ───────────────────────────────────────────────────────────

export type SequenceKeyMoments = {
  keyFrames:         KeyFrameRecord[];
  repSummaries:      RepSummary[];
  symmetryEstimates: SequenceSymmetryEstimate[];
};

// `lunge` (lateral split-squat) and `single_leg_control` (control kind) do knee-
// flexion rep segmentation like the old `lunge_single_leg`. On a frontal capture
// the knee-flexion series doesn't exist (frontal metrics are built instead), so
// rep detection naturally yields nothing there — the honest result.
const STRENGTH_KINDS: MovementAnalysisKind[] = ['squat', 'deadlift', 'lunge', 'single_leg_control', 'lunge_single_leg'];

export function detectKeyMoments(
  kind:           MovementAnalysisKind,
  result:         PoseSequenceResult,
  smoothedSeries: AngleSeries[],
  view:           MovementViewAngle = 'unknown',
  closestSide?:   'left' | 'right',
): SequenceKeyMoments {
  const keyFrames: KeyFrameRecord[] = [];
  const repSummaries: RepSummary[] = [];
  const symmetryEstimates: SequenceSymmetryEstimate[] = [];

  const firstConfident = result.frames.find(f => f.joints.length > 0);
  const lastConfident  = [...result.frames].reverse().find(f => f.joints.length > 0);

  if (firstConfident) {
    keyFrames.push({
      id:        keyFrameId(),
      label:     'Setup',
      timeMs:    firstConfident.timeMs,
      landmarks: filterLandmarksForDisplay(frameLandmarks(result, firstConfident.timeMs), kind, view, closestSide),
      angles:    filterEstimatedAngles(frameAngles(result, kind, firstConfident.timeMs, view) ?? [], kind, view, closestSide),
    });
  }

  if (STRENGTH_KINDS.includes(kind)) {
    const primary = primaryKneeFlexionSeries(smoothedSeries, closestSide);
    const reps = detectReps(primary);

    for (const rep of reps) {
      repSummaries.push({
        ...rep,
        hipMotionAtBottom: closestSide
          ? nearestHipMotion(smoothedSeries, closestSide, rep.bottomMs)
          : undefined,
        trunkAngleAtBottom: nearestValue(findSeries(smoothedSeries, 'Trunk lean', 'center'), rep.bottomMs),
      });
    }

    // Deepest position: global max of the primary series (works even when rep
    // segmentation didn't confidently find a full rep cycle).
    if (primary.length > 0) {
      const deepest = primary.reduce((a, b) => (b.value > a.value ? b : a));
      keyFrames.push({
        id:        keyFrameId(),
        label:     'Deepest position',
        timeMs:    deepest.timeMs,
        landmarks: filterLandmarksForDisplay(frameLandmarks(result, deepest.timeMs), kind, view, closestSide),
        angles:    filterEstimatedAngles(frameAngles(result, kind, deepest.timeMs, view) ?? [], kind, view, closestSide),
      });
    }

    if (lastConfident) {
      keyFrames.push({
        id:        keyFrameId(),
        label:     'Lockout / return',
        timeMs:    lastConfident.timeMs,
        landmarks: filterLandmarksForDisplay(frameLandmarks(result, lastConfident.timeMs), kind, view, closestSide),
        angles:    filterEstimatedAngles(frameAngles(result, kind, lastConfident.timeMs, view) ?? [], kind, view, closestSide),
      });
    }
  } else if (kind === 'bike_fit') {
    if (closestSide) {
      const kneeSeries = findSeries(smoothedSeries, 'Knee flexion', closestSide);
      const values = (kneeSeries?.points ?? [])
        .filter((point): point is AngleSeriesPoint & { degrees: number } => point.degrees !== null);
      if (values.length > 0) {
        const top = values.reduce((a, b) => b.degrees > a.degrees ? b : a);
        const bottom = values.reduce((a, b) => b.degrees < a.degrees ? b : a);
        for (const phase of [
          { label: 'Estimated top pedal phase — manual confirmation required', point: top },
          { label: 'Estimated bottom pedal phase — manual confirmation required', point: bottom },
        ]) {
          keyFrames.push({
            id: keyFrameId(),
            label: phase.label,
            timeMs: phase.point.timeMs,
            landmarks: filterLandmarksForDisplay(
              frameLandmarks(result, phase.point.timeMs),
              kind,
              view,
              closestSide,
            ),
            angles: filterEstimatedAngles(
              frameAngles(result, kind, phase.point.timeMs, view) ?? [],
              kind,
              view,
              closestSide,
            ),
          });
        }
      }
    }
  } else if (kind === 'running_gait') {
    const gaitSides = view === 'side' && closestSide ? [closestSide] : ['left', 'right'] as const;
    for (const side of gaitSides) {
      const kneeSeries = findSeries(smoothedSeries, 'Knee flexion', side);
      const vals = (kneeSeries?.points ?? []).filter(p => p.degrees !== null) as { timeMs: number; degrees: number }[];
      if (vals.length > 0) {
        const peak = vals.reduce((a, b) => (b.degrees > a.degrees ? b : a));
        keyFrames.push({
          id:        keyFrameId(),
          label:     `Peak knee flexion — ${side}`,
          timeMs:    peak.timeMs,
          landmarks: filterLandmarksForDisplay(frameLandmarks(result, peak.timeMs), kind, view, closestSide),
          angles:    filterEstimatedAngles(frameAngles(result, kind, peak.timeMs, view) ?? [], kind, view, closestSide),
        });
      }

      // Estimated contact moments — local maxima of ankle y (lowest point in
      // frame). Always labeled approximate; never presented as measured.
      const ankleY = ankleYSeries(result, side);
      const contacts = findLocalMaxima(ankleY, 500).slice(0, 10);
      contacts.forEach((c, i) => {
        keyFrames.push({
          id:        keyFrameId(),
          label:     `Estimated contact (approximate) — ${side} #${i + 1}`,
          timeMs:    c.timeMs,
          landmarks: filterLandmarksForDisplay(frameLandmarks(result, c.timeMs), kind, view, closestSide),
          angles:    filterEstimatedAngles(frameAngles(result, kind, c.timeMs, view) ?? [], kind, view, closestSide),
        });
      });
    }

    // One lateral clip exposes only the limb closest to the camera. Comparing
    // both detected sides from that view overstates precision, so symmetry is
    // reserved for direct frontal/posterior captures.
    if (view === 'front' || view === 'rear') {
      const symmetry = buildSymmetryEstimate(smoothedSeries);
      if (symmetry) symmetryEstimates.push(symmetry);
    }
  }

  keyFrames.sort((a, b) => a.timeMs - b.timeMs);
  return { keyFrames, repSummaries, symmetryEstimates };
}

// ─── analyzeSequence ─────────────────────────────────────────────────────────

export type SequenceAnalysis = {
  angleSeries:         AngleSeries[];   // smoothed + decimated, ready for inline storage
  keyFrames:           KeyFrameRecord[];
  repSummaries:        RepSummary[];
  symmetryEstimates:   SequenceSymmetryEstimate[];
  confidence:          AnalysisConfidence;
  limitations:         string[];
};

export type RawSequenceMaterial = {
  angleSeries: AngleSeries[];
  keyFrames: KeyFrameRecord[];
};

/**
 * Builds the unfiltered inline sequence material that must be retained for
 * later closest-side correction. The athlete-facing analysis is still derived
 * through analyzeSequence/filterKeyFrames; this copy exists so changing from
 * left to right (or reopening a legacy record) never has to recover a limb that
 * was destructively discarded at save time.
 */
export function buildRawSequenceMaterial(
  result: PoseSequenceResult,
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
): RawSequenceMaterial {
  const angleSeries = decimateAngleSeries(smoothAngleSeries(buildAngleSeries(result, kind, view), 5), 240);

  if (view !== 'side') {
    return {
      angleSeries,
      keyFrames: detectKeyMoments(kind, result, angleSeries, view).keyFrames,
    };
  }

  const keyFrames = (['left', 'right'] as const).flatMap(side => {
    const sideSeries = filterAngleSeries(angleSeries, kind, view, side);
    return detectKeyMoments(kind, result, sideSeries, view, side).keyFrames.map(frame => ({
      ...frame,
      label: frame.label.toLowerCase().includes(`— ${side}`)
        ? frame.label
        : `${frame.label} — ${side}`,
    }));
  });

  keyFrames.sort((a, b) => a.timeMs - b.timeMs || a.label.localeCompare(b.label));
  return { angleSeries, keyFrames };
}

/** One-call convenience wrapper combining the pure steps above — what the
 *  Analyze screen calls after detectPoseSequence resolves. */
export function analyzeSequence(
  result: PoseSequenceResult,
  kind:   MovementAnalysisKind,
  view:   MovementViewAngle,
  closestSide?: 'left' | 'right',
): SequenceAnalysis {
  const raw      = buildAngleSeries(result, kind, view);
  const smoothedRaw = smoothAngleSeries(raw, 5);
  const smoothed = filterAngleSeries(smoothedRaw, kind, view, closestSide);
  const { keyFrames, repSummaries, symmetryEstimates } = detectKeyMoments(kind, result, smoothed, view, closestSide);

  return {
    angleSeries:       decimateAngleSeries(smoothed, 240),
    keyFrames,
    repSummaries,
    symmetryEstimates,
    confidence:        computeSequenceConfidence(result),
    limitations:       buildSequenceLimitations(kind, view),
  };
}
