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
import * as AppleAuthentication from 'expo-apple-authentication';
import { AntDesign } from '@expo/vector-icons';

import { useAuthStore } from '../../src/store/authStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';

export default function SignInScreen() {
  const signIn          = useAuthStore(s => s.signIn);
  const signInWithApple  = useAuthStore(s => s.signInWithApple);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);

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

  async function handleApple() {
    setError(null);
    const err = await signInWithApple();
    if (err) setError(err);
  }

  async function handleGoogle() {
    setError(null);
    const err = await signInWithGoogle();
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

          <Pressable onPress={() => router.push('/auth/forgot-password' as never)} style={s.forgotWrap}>
            <Text style={s.forgotTxt}>Forgot password?</Text>
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerTxt}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.sm}
              style={s.appleBtn}
              onPress={handleApple}
            />
          )}

          <Pressable style={s.googleBtn} onPress={handleGoogle}>
            <AntDesign name="google" size={18} color="#4285F4" />
            <Text style={s.googleBtnTxt}>Continue with Google</Text>
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
    color:         colors.text,
    fontSize:      28,
    fontWeight:    FontWeight.black,
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
  forgotWrap: {
    alignItems: 'center',
    marginTop:  spacing.xs,
  },
  forgotTxt: {
    color:    colors.primary,
    fontSize: FontSize.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: colors.border,
  },
  dividerTxt: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
  },
  appleBtn: {
    height: 50,
    width:  '100%',
  },
  googleBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.bg,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
  },
  googleBtnTxt: {
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
