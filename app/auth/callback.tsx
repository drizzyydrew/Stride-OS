import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTH_CALLBACK_PATH, resolveAuthCallbackUrl } from '../../src/lib/authRedirect';
import { completeAuthLink, cancelAuthLink } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';

function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const incomingUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(() => {
    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      const normalized = paramValue(value);
      if (normalized) queryParams[key] = normalized;
    }
    return Linking.createURL(AUTH_CALLBACK_PATH, { queryParams });
  }, [params, incomingUrl]);

  useEffect(() => {
    let mounted = true, timedOut = false;
    let startedUrl: string | null = null;
    setError(null);
    const timer = setTimeout(() => {
      if (!mounted) return;
      timedOut = true;
      if (startedUrl) cancelAuthLink(startedUrl, 'Sign-in is taking longer than expected. Go back and request a new reset link.');
      setError('Sign-in is taking longer than expected. Go back and request a new reset link.');
    }, 20_000);

    (async () => {
      const initial = incomingUrl ? null : await Linking.getInitialURL();
      if (!mounted || timedOut) return null;
      startedUrl = resolveAuthCallbackUrl(callbackUrl, incomingUrl, initial);
      return completeAuthLink(startedUrl);
    })()
      .then(result => {
        if (!mounted || !result) return;
        clearTimeout(timer);
        if (timedOut) {
          if (result.error) setError(result.error);
          return;
        }
        if (result.error) {
          setError(result.error);
          return;
        }
        if (!result.handled) {
          setError('This link is missing sign-in details. Request a new reset link.');
          return;
        }
        if (result.recovery) {
          router.replace('/auth/new-password' as never);
        } else {
          router.replace('/(tabs)/dashboard' as never);
        }
      })
      .catch(e => {
        clearTimeout(timer);
        if (mounted) setError('This sign-in link could not finish. Request a new link and try again.');
      });

    return () => { mounted = false; clearTimeout(timer); };
  }, [callbackUrl, incomingUrl]);

  return (
    <View style={s.root}>
      {error ? (
        <View style={s.card}>
          <Text style={s.title}>Sign-in link failed</Text>
          <Text style={s.body}>{error}</Text>
          <Pressable style={s.btn} onPress={() => router.replace('/auth/sign-in' as never)}>
            <Text style={s.btnTxt}>Back to Sign In</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.card}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.title}>Finishing sign in...</Text>
        </View>
      )}
    </View>
  );
}


const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 22,
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  btnTxt: {
    color: colors.onPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
