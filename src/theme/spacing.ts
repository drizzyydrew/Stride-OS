import { spacingTokens } from './tokens';

export const spacing = {
  xs:   spacingTokens.space1,
  sm:   spacingTokens.space2,
  md:   spacingTokens.space3,
  lg:   spacingTokens.space4,
  xl:   spacingTokens.space6,
  xxl:  spacingTokens.space8,
  xxxl: 40,

  // Semantic
  cardGap:         16,
  sectionGap:      24,
  screenPadTop:    32,
  screenPadBottom: 120,
} as const;

export { spacingTokens };
