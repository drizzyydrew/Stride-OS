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

export default function NewPasswordScreen() {
  const updatePassword = useAuthStore(s => s.updatePassword);

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function handleUpdate() {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const err = await updatePassword(password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <View style={s.root}>
        <View style={s.successBox}>
          <Text style={s.icon}>✅</Text>
          <Text style={s.successTitle}>Password updated</Text>
          <Text style={s.successDesc}>Your new password is set. Sign in to continue.</Text>
          <Pressable style={s.btn} onPress={() => router.replace('/auth/sign-in' as never)}>
            <Text style={s.btnTxt}>Sign In</Text>
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
          <Text style={s.heading}>Set new password</Text>
          <Text style={s.subheading}>Choose a new password for your account.</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.field}>
            <Text style={s.label}>NEW PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
            />
          </View>

          <Pressable
            style={[s.btn, (loading || !password || !confirm) && s.btnDisabled]}
            onPress={handleUpdate}
            disabled={loading || !password || !confirm}
          >
            {loading
              ? <ActivityIndicator color={colors.text} />
              : <Text style={s.btnTxt}>Update Password</Text>
            }
          </Pressable>
        </View>
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
