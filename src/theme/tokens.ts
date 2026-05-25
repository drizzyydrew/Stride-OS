export const Radius = {
  sm:  8,
  md: 14,
  lg: 24,
} as const;

export const FontSize = {
  xs:      11,  // badge text
  sm:      13,  // helper / meta
  base:    14,  // body / card labels
  md:      16,  // section labels
  lg:      18,  // secondary values, units
  xl:      22,  // workout duration
  xxl:     36,  // metric card values
  hero:    42,  // screen titles
  display: 48,  // trend hero values
} as const;

export const FontWeight = {
  medium: '600' as const,
  bold:   '700' as const,
  black:  '800' as const,
};
