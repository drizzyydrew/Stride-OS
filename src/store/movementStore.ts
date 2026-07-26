// ─── Movement Store ─────────────────────────────────────────────────────────
//
// Persists movement lab videos, analysis sessions, and risk flags locally.
// URI-only storage — actual video binaries remain in the device filesystem.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { toRelativeDocumentPath } from '../lib/mediaPaths';
import { deletePoseSequence } from '../lib/poseSequenceStorage';
import { applyAnalysisViewFilters, normalizeAnalysisKind } from '../utils/measurementMatrix';

import type {
  MovementVideo,
  MovementAnalysisSession,
  GaitFinding,
  LiftingFinding,
  JointAngleEstimate,
  GaitAnalysis,
  LiftingAnalysis,
  MovementRiskFlag,
  MovementActivity,
  MovementAnalysis,
} from '../types/movement';
import type { ReadinessAssessment } from '../types/movementReadiness';

// ─── Store shape ──────────────────────────────────────────────────────────────

type MovementStore = {
  videos:   MovementVideo[];
  sessions: MovementAnalysisSession[];   // one per videoId (lazy-created)
  analyses: MovementAnalysis[];          // V1.5 still-frame analyses
  readinessAssessments: ReadinessAssessment[]; // Wave 2 — running/walking readiness

  // ── Still-frame analyses (V1.5) ───────────────────────────────────────────
  addAnalysis:    (a: Omit<MovementAnalysis, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateAnalysis: (id: string, patch: Partial<MovementAnalysis>) => void;
  removeAnalysis: (id: string) => void;

  // ── Readiness assessments (Wave 2) ────────────────────────────────────────
  addReadinessAssessment:    (a: Omit<ReadinessAssessment, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateReadinessAssessment: (id: string, patch: Partial<ReadinessAssessment>) => void;
  removeReadinessAssessment: (id: string) => void;

  // ── Video CRUD ────────────────────────────────────────────────────────────
  addVideo:    (video: Omit<MovementVideo, 'id' | 'createdAt'>) => string;
  updateVideo: (id: string, patch: Partial<MovementVideo>) => void;
  deleteVideo: (id: string) => void;

  // ── Session access ────────────────────────────────────────────────────────
  getVideoSession:    (videoId: string) => MovementAnalysisSession | undefined;
  ensureSession:      (videoId: string) => void;

  // ── Gait analysis ─────────────────────────────────────────────────────────
  updateGaitAnalysis: (videoId: string, patch: Partial<Omit<GaitAnalysis, 'videoId'>>) => void;

  // ── Lifting analysis ──────────────────────────────────────────────────────
  updateLiftingAnalysis: (videoId: string, patch: Partial<Omit<LiftingAnalysis, 'videoId'>>) => void;

  // ── Gait findings ─────────────────────────────────────────────────────────
  addGaitFinding:    (videoId: string, f: Omit<GaitFinding, 'id' | 'videoId' | 'createdAt'>) => void;
  updateGaitFinding: (videoId: string, id: string, patch: Partial<GaitFinding>) => void;
  deleteGaitFinding: (videoId: string, id: string) => void;

  // ── Lifting findings ───────────────────────────────────────────────────────
  addLiftingFinding:    (videoId: string, f: Omit<LiftingFinding, 'id' | 'videoId' | 'createdAt'>) => void;
  updateLiftingFinding: (videoId: string, id: string, patch: Partial<LiftingFinding>) => void;
  deleteLiftingFinding: (videoId: string, id: string) => void;

  // ── Joint angles ──────────────────────────────────────────────────────────
  addJointAngle:    (videoId: string, a: Omit<JointAngleEstimate, 'id' | 'videoId' | 'createdAt'>) => void;
  updateJointAngle: (videoId: string, id: string, patch: Partial<JointAngleEstimate>) => void;
  deleteJointAngle: (videoId: string, id: string) => void;

  // ── Risk flags ────────────────────────────────────────────────────────────
  addRiskFlag:     (videoId: string, f: Omit<MovementRiskFlag, 'id' | 'videoId' | 'createdAt'>) => void;
  dismissRiskFlag: (flagId: string) => void;

  // ── Computed ──────────────────────────────────────────────────────────────
  getActiveRiskFlags: () => MovementRiskFlag[];

  // ── Reset ─────────────────────────────────────────────────────────────────
  resetMovement: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `mv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowMs(): number {
  return Date.now();
}

function makeEmptySession(videoId: string): MovementAnalysisSession {
  const now = nowMs();
  return {
    id:              uid(),
    videoId,
    createdAt:       now,
    updatedAt:       now,
    analyst:         'manual',
    gaitFindings:    [],
    liftingFindings: [],
    jointAngles:     [],
    riskFlags:       [],
  };
}

function patchSession(
  sessions: MovementAnalysisSession[],
  videoId:  string,
  fn:       (s: MovementAnalysisSession) => MovementAnalysisSession,
): MovementAnalysisSession[] {
  const idx = sessions.findIndex(s => s.videoId === videoId);
  if (idx === -1) {
    const session = makeEmptySession(videoId);
    return [...sessions, fn(session)];
  }
  return sessions.map((s, i) => i === idx ? { ...fn(s), updatedAt: nowMs() } : s);
}

function migrateMovementVideoPaths(video: MovementVideo): MovementVideo {
  return {
    ...video,
    uri: toRelativeDocumentPath(video.uri) ?? video.uri,
  };
}

function migrateMovementAnalysisPaths(analysis: MovementAnalysis): MovementAnalysis {
  return applyAnalysisViewFilters({
    ...analysis,
    // Build 36: migrate the deprecated `lunge_single_leg` kind (and any unknown
    // persisted kind) onto the current taxonomy, keyed by camera view. Every
    // other field is preserved verbatim so Build 32/34/35 records rehydrate and
    // render without loss.
    type: normalizeAnalysisKind(analysis.type, analysis.cameraView),
    mediaUri: toRelativeDocumentPath(analysis.mediaUri) ?? analysis.mediaUri,
    sourceVideoUri: toRelativeDocumentPath(analysis.sourceVideoUri),
    poseSequenceUri: toRelativeDocumentPath(analysis.poseSequenceUri),
    referenceFrameUri: toRelativeDocumentPath(analysis.referenceFrameUri),
  });
}

// ─── Implementation ───────────────────────────────────────────────────────────

export const useMovementStore = create<MovementStore>()(
  persist(
    (set, get) => ({
      videos:   [],
      sessions: [],
      analyses: [],
      readinessAssessments: [],

      // ── Still-frame analyses (V1.5) ──────────────────────────────────────────

      addAnalysis: (a) => {
        const id  = uid();
        const now = nowMs();
        set(state => ({
          analyses: [...state.analyses, migrateMovementAnalysisPaths({ ...a, id, createdAt: now, updatedAt: now })],
        }));
        return id;
      },

      updateAnalysis: (id, patch) =>
        set(state => ({
          analyses: state.analyses.map(a =>
            a.id === id
              ? migrateMovementAnalysisPaths({ ...a, ...patch, id: a.id, createdAt: a.createdAt, updatedAt: nowMs() })
              : a,
          ),
        })),

      removeAnalysis: (id) => {
        // Best-effort: the full frame-by-frame pose file (if any) lives
        // outside the persisted store, so it never gets cleaned up on its
        // own. Fire-and-forget — never blocks or throws into the caller.
        const uri = get().analyses.find(a => a.id === id)?.poseSequenceUri;
        if (uri) void deletePoseSequence(uri);
        set(state => ({
          analyses: state.analyses.filter(a => a.id !== id),
        }));
      },

      // ── Readiness assessments (Wave 2) ───────────────────────────────────────

      addReadinessAssessment: (a) => {
        const id  = uid();
        const now = nowMs();
        set(state => ({
          readinessAssessments: [...state.readinessAssessments, { ...a, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },

      updateReadinessAssessment: (id, patch) =>
        set(state => ({
          readinessAssessments: state.readinessAssessments.map(a =>
            a.id === id ? { ...a, ...patch, id: a.id, createdAt: a.createdAt, updatedAt: nowMs() } : a,
          ),
        })),

      removeReadinessAssessment: (id) =>
        set(state => ({
          readinessAssessments: state.readinessAssessments.filter(a => a.id !== id),
        })),

      // ── Video CRUD ──────────────────────────────────────────────────────────

      addVideo: (video) => {
        const id = uid();
        set(state => ({
          videos: [...state.videos, migrateMovementVideoPaths({ ...video, id, createdAt: nowMs() })],
        }));
        return id;
      },

      updateVideo: (id, patch) =>
        set(state => ({
          videos: state.videos.map(v => v.id === id ? migrateMovementVideoPaths({ ...v, ...patch }) : v),
        })),

      deleteVideo: (id) =>
        set(state => ({
          videos:   state.videos.filter(v => v.id !== id),
          sessions: state.sessions.filter(s => s.videoId !== id),
        })),

      // ── Session access ──────────────────────────────────────────────────────

      getVideoSession: (videoId) =>
        get().sessions.find(s => s.videoId === videoId),

      ensureSession: (videoId) => {
        const existing = get().sessions.find(s => s.videoId === videoId);
        if (!existing) {
          set(state => ({
            sessions: [...state.sessions, makeEmptySession(videoId)],
          }));
        }
      },

      // ── Gait analysis ───────────────────────────────────────────────────────

      updateGaitAnalysis: (videoId, patch) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            gaitAnalysis: {
              videoId,
              footStrike:          'unknown',
              overstride:          null,
              crossoverGait:       null,
              verticalOscillation: 'unknown',
              trunkLean:           'unknown',
              hipDrop:             null,
              pelvicControl:       null,
              kneeValgus:          null,
              armSwing:            'unknown',
              symmetry:            'unknown',
              ...s.gaitAnalysis,
              ...patch,
            },
          })),
        })),

      // ── Lifting analysis ────────────────────────────────────────────────────

      updateLiftingAnalysis: (videoId, patch) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            liftingAnalysis: {
              videoId,
              exercise:    '',
              depth:       'unknown',
              hipStrategy: 'unknown',
              kneeValgus:  null,
              barPath:     'unknown',
              asymmetry:   'unknown',
              ...s.liftingAnalysis,
              ...patch,
            },
          })),
        })),

      // ── Gait findings ───────────────────────────────────────────────────────

      addGaitFinding: (videoId, f) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            gaitFindings: [
              ...s.gaitFindings,
              { ...f, id: uid(), videoId, createdAt: nowMs() },
            ],
          })),
        })),

      updateGaitFinding: (videoId, id, patch) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            gaitFindings: s.gaitFindings.map(f =>
              f.id === id ? { ...f, ...patch } : f,
            ),
          })),
        })),

      deleteGaitFinding: (videoId, id) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            gaitFindings: s.gaitFindings.filter(f => f.id !== id),
          })),
        })),

      // ── Lifting findings ────────────────────────────────────────────────────

      addLiftingFinding: (videoId, f) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            liftingFindings: [
              ...s.liftingFindings,
              { ...f, id: uid(), videoId, createdAt: nowMs() },
            ],
          })),
        })),

      updateLiftingFinding: (videoId, id, patch) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            liftingFindings: s.liftingFindings.map(f =>
              f.id === id ? { ...f, ...patch } : f,
            ),
          })),
        })),

      deleteLiftingFinding: (videoId, id) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            liftingFindings: s.liftingFindings.filter(f => f.id !== id),
          })),
        })),

      // ── Joint angles ────────────────────────────────────────────────────────

      addJointAngle: (videoId, a) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            jointAngles: [
              ...s.jointAngles,
              { ...a, id: uid(), videoId, createdAt: nowMs() },
            ],
          })),
        })),

      updateJointAngle: (videoId, id, patch) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            jointAngles: s.jointAngles.map(a =>
              a.id === id ? { ...a, ...patch } : a,
            ),
          })),
        })),

      deleteJointAngle: (videoId, id) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            jointAngles: s.jointAngles.filter(a => a.id !== id),
          })),
        })),

      // ── Risk flags ──────────────────────────────────────────────────────────

      addRiskFlag: (videoId, f) =>
        set(state => ({
          sessions: patchSession(state.sessions, videoId, s => ({
            ...s,
            riskFlags: [
              ...s.riskFlags,
              { ...f, id: uid(), videoId, createdAt: nowMs(), active: true },
            ],
          })),
        })),

      dismissRiskFlag: (flagId) =>
        set(state => ({
          sessions: state.sessions.map(s => ({
            ...s,
            riskFlags: s.riskFlags.map(f =>
              f.id === flagId ? { ...f, active: false } : f,
            ),
          })),
        })),

      // ── Computed ────────────────────────────────────────────────────────────

      getActiveRiskFlags: () =>
        get().sessions.flatMap(s =>
          s.riskFlags.filter(f => f.active),
        ),

      // ── Reset ───────────────────────────────────────────────────────────────

      resetMovement: () => set({ videos: [], sessions: [], analyses: [], readinessAssessments: [] }),
    }),
    {
      name:    'movement-store',
      storage: createAppJSONStorage(),
      version: 2,
      migrate: (persisted, _version) => {
        const state = persisted as Partial<MovementStore>;
        return {
          ...state,
          videos: (state.videos ?? []).map(migrateMovementVideoPaths),
          analyses: (state.analyses ?? []).map(migrateMovementAnalysisPaths),
          readinessAssessments: state.readinessAssessments ?? [],
        };
      },
      // Older persisted stores predate `analyses`/`readinessAssessments` —
      // default them to [] on rehydrate.
      merge: (persisted, current) => {
        const state = persisted as Partial<MovementStore> | undefined;
        return {
          ...current,
          ...state,
          videos:   (state?.videos   ?? current.videos).map(migrateMovementVideoPaths),
          sessions: state?.sessions ?? current.sessions,
          analyses: (state?.analyses ?? current.analyses).map(migrateMovementAnalysisPaths),
          readinessAssessments: state?.readinessAssessments ?? current.readinessAssessments,
        };
      },
    },
  ),
);
