import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { assertMovementLabWork, attachMovementLabWork, beginMovementLabWork, recheckMovementLabWork, type MovementLabWork } from '../lib/movementLabAccess';
import { getProAccess } from '../lib/pro-access';

export function useMovementLabWork() {
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const report = useCallback((error: unknown) => {
    if (!alive.current) return;
    const access = getProAccess('movement-lab');
    Alert.alert('Movement Lab', error instanceof Error ? error.message : 'This work could not continue. Your saved clips and results remain available.', [
      ...(access.status === 'inactive' ? [{ text: 'Explore StrideOS Pro', onPress: () => router.push('/(tabs)/settings/membership' as never) }] : []),
      { text: 'OK', style: 'cancel' },
    ]);
  }, []);
  const begin = useCallback(async () => {
    try { return await beginMovementLabWork(() => alive.current); }
    catch (error) { report(error); return null; }
  }, [report]);
  const check = useCallback((work: MovementLabWork | null | undefined) => {
    try { assertMovementLabWork(work); return true; }
    catch (error) { report(error); return false; }
  }, [report]);
  const refresh = useCallback(async (work: MovementLabWork | null | undefined) => {
    try { await recheckMovementLabWork(work); return true; }
    catch (error) { report(error); return false; }
  }, [report]);
  const attach = useCallback(async <T,>(work: MovementLabWork | null | undefined, write: () => Promise<T>) => {
    try { return { allowed: true as const, value: await attachMovementLabWork(work, write) }; }
    catch (error) { report(error); return { allowed: false as const, value: undefined }; }
  }, [report]);
  return { begin, check, refresh, attach };
}
