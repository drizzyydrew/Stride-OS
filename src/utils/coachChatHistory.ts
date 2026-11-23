export const COACH_CHAT_KEY = 'strideos-coach-chat-v1';
export const COACH_CHAT_LIFETIME_MS = 24 * 60 * 60 * 1000;
export type SavedCoachMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: number; delivery?: 'failed' };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type State = { owner: string | null; ready: boolean; error: string | null; messages: SavedCoachMessage[] };

/** Chat text is local, separate from the profile and from purchase accounting.
 * The expiry filter is applied on hydration, display refresh and every send.
 * A dormant OS cannot run a timer: physical cleanup resumes on foreground. */
export function unexpiredCoachMessages(messages: readonly SavedCoachMessage[], now: number): SavedCoachMessage[] {
  return messages.filter(message => message.createdAt <= now && now - message.createdAt < COACH_CHAT_LIFETIME_MS);
}

export function createCoachChatHistory(storage: Storage, now = Date.now) {
  let state: State = { owner: null, ready: false, error: null, messages: [] };
  let generation = 0;
  let clockFloor = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (update: Partial<State>) => { state = { ...state, ...update }; listeners.forEach(listener => listener()); };
  const instant = () => {
    const value = now();
    // Fail closed if the device moves backwards: expired text must not return.
    clockFloor = Math.max(clockFloor, value);
    return clockFloor;
  };
  const persist = async (token: number) => {
    const snapshot = { version: 1, owner: state.owner, clockFloor: instant(), messages: state.messages };
    const task = writes.then(async () => {
      if (token !== generation || !snapshot.owner) return;
      await storage.setItem(COACH_CHAT_KEY, JSON.stringify(snapshot));
    });
    writes = task.catch(() => undefined);
    try { await task; }
    catch {
      if (token === generation) publish({ error: 'Chat could not be saved on this device. Your message balance is managed separately.' });
      throw new Error('Saved chat could not be updated on this device. Recover the last reply before sending again.');
    }
  };
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async setOwner(owner: string | null) {
      const token = ++generation;
      clockFloor = 0;
      publish({ owner, ready: false, error: null, messages: [] });
      if (!owner) { publish({ ready: true }); return; }
      try {
        await writes;
        const raw = await storage.getItem(COACH_CHAT_KEY);
        if (token !== generation) return;
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && (saved.version !== 1 || saved.owner !== owner || !Array.isArray(saved.messages)
          || saved.messages.length > 1000 || !Number.isFinite(saved.clockFloor)
          || saved.messages.some((message: SavedCoachMessage) => !message || typeof message.id !== 'string'
            || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string'
            || message.content.length > 16000 || !Number.isFinite(message.createdAt)
            || (message.delivery !== undefined && message.delivery !== 'failed')))) throw new Error('Invalid chat record');
        clockFloor = saved?.clockFloor ?? 0;
        const messages = unexpiredCoachMessages(saved?.messages ?? [], instant());
        publish({ ready: true, messages });
        if (saved && messages.length !== saved.messages.length) await persist(token);
      } catch {
        if (token === generation) publish({ ready: false, error: 'Saved chat could not be read. Retry before starting a conversation; existing records have not been overwritten.' });
      }
    },
    async prune() {
      if (!state.owner || !state.ready) return [];
      const messages = unexpiredCoachMessages(state.messages, instant());
      if (messages.length !== state.messages.length) { publish({ messages }); await persist(generation); }
      return messages;
    },
    async append(message: SavedCoachMessage, expectedOwner = state.owner) {
      if (!state.owner || state.owner !== expectedOwner || !state.ready) throw new Error('Chat history or account changed. Retry in a moment.');
      const time = instant();
      if (!message.id || !message.content.trim() || !['user', 'assistant'].includes(message.role)
        || message.content.length > 16000 || !Number.isFinite(message.createdAt)
        || message.createdAt > time || time - message.createdAt >= COACH_CHAT_LIFETIME_MS) throw new Error('Message has expired or is invalid.');
      const messages = unexpiredCoachMessages(state.messages, time);
      if (messages.some(item => item.id === message.id)) return;
      if (messages.length >= 1000) throw new Error('This device has reached its temporary chat limit. Older messages expire automatically.');
      publish({ messages: [...messages, message], error: null });
      const token = generation;
      try { await persist(token); }
      catch (error) {
        if (token === generation) publish({ messages: state.messages.filter(item => item.id !== message.id) });
        throw error;
      }
    },
    async markFailed(id: string, expectedOwner: string | null) {
      if (!expectedOwner || state.owner !== expectedOwner || !state.ready) throw new Error('Your account changed.');
      publish({ messages: unexpiredCoachMessages(state.messages, instant()).map(message => message.id === id
        ? { ...message, delivery: 'failed' as const } : message) });
      await persist(generation);
    },
    drain: () => writes,
  };
}
