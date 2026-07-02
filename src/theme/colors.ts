// ─── StrideOS V2 Design Tokens ─────────────────────────────────────────────
//
// Semantic color tokens derived from docs/design/v2/DESIGN_SYSTEM.md.
// `lightColors` / `darkColors` are the only color values the app should ever
// render — never a bare hex literal in a component. Read them via the
// `useThemeColors()` hook in `./ThemeContext`, not by importing this module
// directly (the values below do not react to the user's color scheme).

// ─── Core palette (mode-invariant) ─────────────────────────────────────────
// These six colors are the entire brand palette (§3.1). Status colors are
// strictly semantic (§3.7) and never reused for decoration.

export const sage        = '#8B927C';
export const clay        = '#DCC0A7';
export const steel       = '#708489';
export const brown       = '#4D433E';
export const sand        = '#EFE7DA';
export const white       = '#FFFFFF';

export const success     = '#5F8A5C';
export const warningHex  = '#C98A3E';
export const destructive = '#C1483B';

// ─── Theme shape ────────────────────────────────────────────────────────────

export type ThemeColors = {
  // Surfaces
  bg:     string; // bg.base
  card:   string; // surface.raised
  sunken: string; // surface.sunken
  border: string; // border.default

  // Text
  text:       string; // text.primary
  textMuted:  string; // text.secondary
  textDim:    string; // text.tertiary
  textSubtle: string; // text.tertiary (placeholder-weight)
  onAccent:   string; // text.onAccent — always dark Brown, both modes

  // Brand
  primary:    string; // Clay — CTAs, selection, warmth
  primaryDim: string; // Clay tonal tint
  sage:       string; // Sage — state / progress / "in motion"
  clay:       string;
  steel:      string;

  // Status (strictly semantic — see §3.7)
  positive:    string; // success
  positiveDim: string;
  warning:     string;
  warningDim:  string;
  critical:    string; // destructive
  criticalDim: string;
  neutral:     string; // Steel — structural neutral
  danger:      string; // destructive (alias of critical)
};

// ─── Light — warm Sand / White (§3.3) ──────────────────────────────────────

export const lightColors: ThemeColors = {
  bg:     sand,
  card:   white,
  sunken: '#E4DACB',
  border: 'rgba(77,67,62,0.14)',

  text:       brown,
  textMuted:  'rgba(77,67,62,0.65)',
  textDim:    'rgba(77,67,62,0.40)',
  textSubtle: 'rgba(77,67,62,0.40)',
  onAccent:   brown,

  primary:    clay,
  primaryDim: '#F9F5F1',
  sage,
  clay,
  steel,

  positive:    success,
  positiveDim: '#E5ECE5',
  warning:     warningHex,
  warningDim:  '#F6ECE0',
  critical:    destructive,
  criticalDim: '#F5E2E0',
  neutral:     steel,
  danger:      destructive,
};

// ─── Dark — Brown / near-black (§3.3) ──────────────────────────────────────

export const darkColors: ThemeColors = {
  bg:     '#161513',
  card:   '#211E1B',
  sunken: '#100F0E',
  border: 'rgba(255,255,255,0.16)',

  text:       white,
  textMuted:  'rgba(255,255,255,0.70)',
  textDim:    'rgba(255,255,255,0.45)',
  textSubtle: 'rgba(255,255,255,0.45)',
  onAccent:   brown,

  primary:    clay,
  primaryDim: '#4A423A',
  sage,
  clay,
  steel,

  positive:    success,
  positiveDim: '#2F3629',
  warning:     warningHex,
  warningDim:  '#463623',
  critical:    destructive,
  criticalDim: '#442722',
  neutral:     steel,
  danger:      destructive,
};

// ─── Zone / category tint ramp ─────────────────────────────────────────────
//
// StrideOS never uses a red→green "traffic light" ramp for training zones or
// categories (§3.7, §3.9) — intensity is communicated by a single accent at
// increasing opacity, not by hue. Use for HR/pace zone badges (Z1–Z5),
// workout-type dots, etc. `index` is 0-based, `count` is the number of steps.

export function zoneTint(colors: ThemeColors, index: number, count: number): string {
  const steps = Math.max(count - 1, 1);
  const t     = Math.min(Math.max(index / steps, 0), 1); // 0..1
  const alpha = 0.35 + t * 0.65;                          // 35%..100% of sage
  const hex   = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
  return `${colors.sage}${hex}`;
}

/** Low-alpha companion to `zoneTint`, for a zone badge/row's tonal fill
 *  behind the full-strength `zoneTint` foreground (§13 Badges: "tonal fill"). */
export function zoneTintBg(colors: ThemeColors, index: number, count: number): string {
  const steps = Math.max(count - 1, 1);
  const t     = Math.min(Math.max(index / steps, 0), 1);
  const alpha = 0.10 + t * 0.12;                          // 10%..22% of sage
  const hex   = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
  return `${colors.sage}${hex}`;
}

// ─── Overlay ────────────────────────────────────────────────────────────────
//
// A mode-invariant translucent black scrim behind bottom sheets / modals
// (§3.3 surface.overlay). Not tinted per-theme like other surfaces because
// its job is purely to dim whatever photo/map/content sits behind it.

export const overlay = 'rgba(0,0,0,0.7)';
