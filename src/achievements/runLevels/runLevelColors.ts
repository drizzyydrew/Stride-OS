import { APPROVED_PALETTE } from "./approvedPalette";

export type RunLevelColorTokens = {
  outer: string;
  mid: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const RUN_LEVEL_NEAR_BLACK = '#080909';
export const RUN_LEVEL_PANEL_BLACK = '#0D0E0E';
export const RUN_LEVEL_LOCKED_GRAY = '#9A9892';

export const RUN_LEVEL_COLORS = {
  foundation: { outer: APPROVED_PALETTE.run_level_foundation.primary, mid: "#A18E6D", highlight: APPROVED_PALETTE.run_level_foundation.highlight, shadow: APPROVED_PALETTE.run_level_foundation.shadow, glow: APPROVED_PALETTE.run_level_foundation.primary },
  rhythm: { outer: APPROVED_PALETTE.run_level_rhythm.primary, mid: "#955C37", highlight: APPROVED_PALETTE.run_level_rhythm.highlight, shadow: APPROVED_PALETTE.run_level_rhythm.shadow, glow: APPROVED_PALETTE.run_level_rhythm.primary },
  momentum: { outer: APPROVED_PALETTE.run_level_momentum.primary, mid: "#788557", highlight: APPROVED_PALETTE.run_level_momentum.highlight, shadow: APPROVED_PALETTE.run_level_momentum.shadow, glow: APPROVED_PALETTE.run_level_momentum.primary },
  durability: { outer: APPROVED_PALETTE.run_level_durability.primary, mid: "#627E97", highlight: APPROVED_PALETTE.run_level_durability.highlight, shadow: APPROVED_PALETTE.run_level_durability.shadow, glow: APPROVED_PALETTE.run_level_durability.primary },
  engine: { outer: APPROVED_PALETTE.run_level_engine.primary, mid: "#5B5D59", highlight: APPROVED_PALETTE.run_level_engine.highlight, shadow: APPROVED_PALETTE.run_level_engine.shadow, glow: APPROVED_PALETTE.run_level_engine.primary },
  peak: { outer: APPROVED_PALETTE.run_level_peak.primary, mid: "#526478", highlight: APPROVED_PALETTE.run_level_peak.highlight, shadow: APPROVED_PALETTE.run_level_peak.shadow, glow: APPROVED_PALETTE.run_level_peak.primary },
  summit: { outer: APPROVED_PALETTE.run_level_summit.primary, mid: "#A47732", highlight: APPROVED_PALETTE.run_level_summit.highlight, shadow: APPROVED_PALETTE.run_level_summit.shadow, glow: APPROVED_PALETTE.run_level_summit.primary },
} as const satisfies Record<string, RunLevelColorTokens>;
