import { spacingTokens } from './tokens';

export const spacing = {
  xs:   spacingTokens.space1,
  sm:   spacingTokens.space2,
  md:   spacingTokens.space3,
  lg:   spacingTokens.space4,
  xl:   spacingTokens.space6,
  xxl:  spacingTokens.space8,
  xxxl: 48,

  // Semantic
  cardGap:         18,
  sectionGap:      28,
  screenPadTop:    48,
  screenPadBottom: 120,
} as const;

export { spacingTokens };
