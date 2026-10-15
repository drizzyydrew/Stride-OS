type BackAction = { path: string; invoke: () => void };

export function createBackActionRegistry() {
  const actions = new Map<symbol, BackAction>();
  return {
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
