// ─── Movement Store ─────────────────────────────────────────────────────────
//
// Persists movement lab videos, analysis sessions, and risk flags locally.
// URI-only storage — actual video binaries remain in the device filesystem.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
} from '../types/movement';

// ─── Store shape ──────────────────────────────────────────────────────────────

type MovementStore = {
  videos:   MovementVideo[];
  sessions: MovementAnalysisSession[];   // one per videoId (lazy-created)

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

// ─── Implementation ───────────────────────────────────────────────────────────

export const useMovementStore = create<MovementStore>()(
  persist(
    (set, get) => ({
      videos:   [],
      sessions: [],

      // ── Video CRUD ──────────────────────────────────────────────────────────

      addVideo: (video) => {
        const id = uid();
        set(state => ({
          videos: [...state.videos, { ...video, id, createdAt: nowMs() }],
        }));
        return id;
      },

      updateVideo: (id, patch) =>
        set(state => ({
          videos: state.videos.map(v => v.id === id ? { ...v, ...patch } : v),
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

      resetMovement: () => set({ videos: [], sessions: [] }),
    }),
    {
      name:    'movement-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
