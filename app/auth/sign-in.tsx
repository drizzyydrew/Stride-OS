import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';

export default function SignInScreen() {
  const signIn = useAuthStore(s => s.signIn);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <Text style={s.logo}>⚡</Text>
          <Text style={s.appName}>StrideOS</Text>
          <Text style={s.tagline}>Your performance operating system</Text>
        </View>

        <View style={s.card}>
          <Text style={s.heading}>Sign in</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
            />
          </View>

          <Pressable
            style={[s.btn, (loading || !email || !password) && s.btnDisabled]}
            onPress={handleSignIn}
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading
              ? <ActivityIndicator color={colors.text} />
              : <Text style={s.btnTxt}>Sign In</Text>
            }
          </Pressable>
        </View>

        <Pressable style={s.toggle} onPress={() => router.replace('/auth/sign-up' as never)}>
          <Text style={s.toggleTxt}>
            Don't have an account? <Text style={s.toggleLink}>Sign up</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow:        1,
    justifyContent:  'center',
    padding:         spacing.xl,
    gap:             spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap:        spacing.xs,
  },
  logo: {
    fontSize: 48,
  },
  appName: {
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
    letterSpacing: 1,
  },
  tagline: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.xl,
    gap:             spacing.lg,
  },
  heading: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  error: {
    color:           colors.critical,
    fontSize:        FontSize.sm,
    backgroundColor: colors.critical + '18',
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnTxt: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  toggle: {
    alignItems: 'center',
  },
  toggleTxt: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
  },
  toggleLink: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
});
