import React, { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type ToastMessage = {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: Omit<ToastMessage, 'id'> & { durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: Omit<ToastMessage, 'id'> & { durationMs?: number }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = idRef.current + 1;
    idRef.current = id;
    setToast({ id, title: next.title, message: next.message, variant: next.variant });
    timerRef.current = setTimeout(() => setToast(null), next.durationMs ?? 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toast={toast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.use(ToastContext);
}

function ToastViewport({ toast }: { toast: ToastMessage | null }) {
  const theme = useTheme();
  if (!toast) return null;

  const accent = toast.variant === 'success'
    ? theme.colors.positive
    : toast.variant === 'warning'
      ? theme.colors.warning
      : toast.variant === 'error'
        ? theme.colors.critical
        : theme.colors.primary;

  return (
    <View pointerEvents="none" style={styles.viewport}>
      <View style={[styles.toast, { backgroundColor: theme.colors.card, borderColor: accent }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{toast.title}</Text>
        {toast.message ? <Text selectable style={[styles.message, { color: theme.colors.textMuted }]}>{toast.message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
  },
  toast: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    borderCurve: 'continuous',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
});
