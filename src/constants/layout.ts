// All layout-level measurements in one place.
// Update here to affect spacing globally across every screen.

export const LAYOUT = {
  // Tab bar
  tabBarHeight:    84,
  tabBarPadBottom: 20,
  tabBarPadTop:    12,

  // Screen
  screenPadH:      24,
  screenPadBottom: 120,  // scroll room above tab bar

  // Header
  headerPadV: 20,  // vertical padding around the title block

  // Floating action button
  fabSize:         56,
  fabBottomOffset: 100,  // above tab bar
  fabRight:        24,

  // Max width for content columns — phone-native on small screens,
  // centered pillar on tablets and web.
  maxContentWidth: 480,

  // Breakpoints for future responsive / tablet support
  breakpoints: {
    phone:  0,
    tablet: 744,
    wide:   1024,
  },
} as const;
