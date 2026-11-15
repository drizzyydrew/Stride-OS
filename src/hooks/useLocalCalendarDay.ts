import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayDateOnly } from '../utils/dateOnly';

/** Refresh age at local midnight, foreground and timezone changes. No saved
 * demographics or historical workout records are rewritten by a clock tick. */
export function useLocalCalendarDay(): string {
  const [day, setDay] = useState(() => todayDateOnly());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDay(todayDateOnly());
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, Math.max(1000, midnight.getTime() - now.getTime() + 50));
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return day;
}
