export type ChallengeColorTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
};

export const CHALLENGES_NEAR_BLACK = '#090A09';
export const CHALLENGES_PANEL_BLACK = '#050606';
export const CHALLENGES_LOCKED_GRAY = '#8E8E88';

export type ChallengeColorTokenName =
  | 'challengeAugust'
  | 'challengeSeptember'
  | 'challengeWinter'
  | 'challengeSpring'
  | 'challengeSummer'
  | 'challengeElevation'
  | 'challenge5kMonth'
  | 'challenge25kWeek'
  | 'challenge50kMonth'
  | 'challenge100kMonth'
  | 'challengeStrengthRun'
  | 'challengeRecovery';

export const CHALLENGES_COLORS: Record<ChallengeColorTokenName, ChallengeColorTokens> = {
  challengeAugust: { primary: '#E0914A', secondary: '#C96A2E', highlight: '#F6C793', shadow: '#7A4015', glow: '#D97B32', text: '#F0CDA0' },
  challengeSeptember: { primary: '#4FB89A', secondary: '#2E8E74', highlight: '#A6E6D2', shadow: '#1F5C4B', glow: '#3FA183', text: '#B7E4D5' },
  challengeWinter: { primary: '#5A8FD6', secondary: '#3E6CB0', highlight: '#AECBF2', shadow: '#2A4C82', glow: '#4A7BC4', text: '#B9D2F0' },
  challengeSpring: { primary: '#8FBF6E', secondary: '#6C9E4C', highlight: '#CBE8AE', shadow: '#4A6B32', glow: '#7CAE5C', text: '#CCE3B6' },
  challengeSummer: { primary: '#E0624A', secondary: '#C2402C', highlight: '#F3A892', shadow: '#7A2A1C', glow: '#D14E38', text: '#F0B6A4' },
  challengeElevation: { primary: '#8F6FD6', secondary: '#6B4DB0', highlight: '#C9B6F2', shadow: '#4A3482', glow: '#7C5BC4', text: '#D6C7F0' },
  challenge5kMonth: { primary: '#D664A8', secondary: '#B3457F', highlight: '#F0A9D4', shadow: '#6E2650', glow: '#C4528E', text: '#F0C1DF' },
  challenge25kWeek: { primary: '#6A7FD9', secondary: '#4A5CB3', highlight: '#B0BBF0', shadow: '#2E3A80', glow: '#5A6CC4', text: '#C2CBF2' },
  challenge50kMonth: { primary: '#3FBFBA', secondary: '#2A9792', highlight: '#9FE6E2', shadow: '#1C5F5C', glow: '#33ACA7', text: '#B5E6E3' },
  challenge100kMonth: { primary: '#E0A83F', secondary: '#C2872A', highlight: '#F6D894', shadow: '#7A5A15', glow: '#D1991F', text: '#F0DDAC' },
  challengeStrengthRun: { primary: '#D6639A', secondary: '#B3456F', highlight: '#F0A8C8', shadow: '#6E2648', glow: '#C45186', text: '#F0C0D6' },
  challengeRecovery: { primary: '#9FBF8D', secondary: '#7FB5AE', highlight: '#D5E7C4', shadow: '#516F5D', glow: '#7DAE86', text: '#BFD6AE' },
};

export const CHALLENGES_LOCKED_COLORS: ChallengeColorTokens = {
  primary: CHALLENGES_LOCKED_GRAY,
  secondary: '#62625E',
  highlight: '#CACAC4',
  shadow: '#444541',
  glow: '#767670',
  text: '#A9A9A3',
};
