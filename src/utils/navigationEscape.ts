// These destinations are section landing pages; detail routes keep real Back.
const SECTION_ROOTS = new Set(['/', '/dashboard', '/calendar', '/training', '/coach', '/more',
  '/activity', '/strength', '/movement', '/analytics', '/performance', '/profile', '/settings', '/activity-log']);
export function isSectionRoot(path: string): boolean { return SECTION_ROOTS.has(path.replace(/\/index$/, '').replace(/\/$/, '') || '/'); }

type BackAction = { path: string; invoke: () => void };

export function createBackActionRegistry() {
  const actions = new Map<symbol, BackAction>();
  let todayScroll: (() => void) | null = null;
  let pendingTodayTop = false;
  return {
    requestTodayTop() {
      pendingTodayTop = true;
      if (todayScroll) { pendingTodayTop = false; todayScroll(); }
    },
    registerTodayScroll(scroll: () => void) {
      todayScroll = scroll;
      if (pendingTodayTop) { pendingTodayTop = false; scroll(); }
      return () => { if (todayScroll === scroll) todayScroll = null; };
    },
    register(key: symbol, action: BackAction) {
      actions.set(key, action);
      return () => { actions.delete(key); };
    },
    handle(path: string): boolean {
      const active = [...actions.values()].reverse().find(action => action.path === path);
      if (!active) return false;
      active.invoke();
      return true;
    },
  };
}
