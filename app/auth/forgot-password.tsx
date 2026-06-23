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

export default function ForgotPasswordScreen() {
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const err = await resetPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View style={s.root}>
        <View style={s.successBox}>
          <Text style={s.icon}>✉️</Text>
          <Text style={s.successTitle}>Check your email</Text>
          <Text style={s.successDesc}>
            We sent a password reset link to {email}. Click the link to set a new password, then sign in.
          </Text>
          <Pressable style={s.btn} onPress={() => router.replace('/auth/sign-in' as never)}>
            <Text style={s.btnTxt}>Back to Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.heading}>Reset password</Text>
          <Text style={s.subheading}>
            Enter your email and we will send you a link to reset your password.
          </Text>

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

          <Pressable
            style={[s.btn, (loading || !email.trim()) && s.btnDisabled]}
            onPress={handleReset}
            disabled={loading || !email.trim()}
          >
            {loading
              ? <ActivityIndicator color={colors.text} />
              : <Text style={s.btnTxt}>Send Reset Link</Text>
            }
          </Pressable>
        </View>

        <Pressable style={s.back} onPress={() => router.back()}>
          <Text style={s.backTxt}>← Back to Sign In</Text>
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
    flexGrow:       1,
    justifyContent: 'center',
    padding:        spacing.xl,
    gap:            spacing.xl,
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
  subheading: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 20,
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
  back: {
    alignItems: 'center',
  },
  backTxt: {
    color:    colors.primary,
    fontSize: FontSize.sm,
  },
  successBox: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing.xl,
    gap:            spacing.lg,
  },
  icon:         { fontSize: 48 },
  successTitle: { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
  successDesc:  { color: colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
});
