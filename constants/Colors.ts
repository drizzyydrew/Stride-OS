// Default color lookup for the (legacy) `components/Themed` helpers.
// Values are sourced from the StrideOS V2 design tokens — see
// docs/design/v2/DESIGN_SYSTEM.md and src/theme/colors.ts.
import { darkColors, lightColors } from '@/src/theme/colors';

export default {
  light: {
    text:            lightColors.text,
    background:      lightColors.bg,
    tint:            lightColors.primary,
    tabIconDefault:  lightColors.textDim,
    tabIconSelected: lightColors.primary,
  },
  dark: {
    text:            darkColors.text,
    background:      darkColors.bg,
    tint:            darkColors.primary,
    tabIconDefault:  darkColors.textDim,
    tabIconSelected: darkColors.primary,
  },
};
