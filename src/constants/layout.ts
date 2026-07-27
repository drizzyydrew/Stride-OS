// All layout-level measurements in one place.
// Update here to affect spacing globally across every screen.

export const LAYOUT = {
  // Tab bar
  tabBarHeight:    94,
  tabBarPadBottom: 26,
  tabBarPadTop:    10,

  // Screen
  screenPadH:      20,
  screenPadBottom: 148,  // scroll room above tab bar

  // Header
  headerPadV: 20,  // vertical padding around the title block

  // Floating action button
  fabSize:         56,
  fabBottomOffset: 100,  // above tab bar
  fabRight:        24,

  // Max width for content columns — phone-native on small screens,
  // centered pillar on tablets and web.
  maxContentWidth: 480,

  // Breakpoints
  breakpoints: {
    phone:  0,
    tablet: 744,
    wide:   1024,
  },
} as const;

export const TAB_BAR_VISUAL_CONTRACT = {
  iconSize: 25,
  iconBoxSize: 30,
  labelFontSize: 10,
  labelLineHeight: 12,
  itemMinHeight: 54,
  iconToLabelGap: 4,
  itemPaddingVertical: 3,
  itemPaddingHorizontal: 0,
} as const;

export const VISIBLE_BOTTOM_TABS = ['Today', 'Calendar', 'Running', 'Strength', 'AI Coach', 'More'] as const;

// Returns the appropriate max content width for a given screen width.
//   Phone  (<744px):  fills full width; padding applied by ScrollScreen
//   Tablet (744–1024): 88% up to 760px
//   Wide   (≥1024px): 75% up to 960px
export function responsiveContentWidth(screenWidth: number): number {
  if (screenWidth >= LAYOUT.breakpoints.wide)   return Math.min(Math.round(screenWidth * 0.75), 960);
  if (screenWidth >= LAYOUT.breakpoints.tablet) return Math.min(Math.round(screenWidth * 0.88), 760);
  return screenWidth;
}
