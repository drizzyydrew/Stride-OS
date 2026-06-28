import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type SocialAuthButtonsProps = {
  mode?: 'sign-in' | 'sign-up';
  onError: (message: string | null) => void;
};

export function SocialAuthButtons({ mode = 'sign-in', onError }: SocialAuthButtonsProps) {
  const signInWithApple = useAuthStore(s => s.signInWithApple);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);

  async function handleProvider(provider: 'apple' | 'google') {
    setLoadingProvider(provider);
    onError(null);
    const error = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setLoadingProvider(null);
    if (error) onError(error);
  }

  return (
    <View style={s.wrap}>
      <View style={s.divider}>
        <View style={s.line} />
        <Text style={s.dividerTxt}>OR</Text>
        <View style={s.line} />
      </View>

      {Platform.OS === 'ios' ? (
        <View style={s.appleButtonWrap}>
          {loadingProvider === 'apple' ? (
            <View style={[s.providerBtn, s.providerBtnDisabled]}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={mode === 'sign-up'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.sm}
              style={s.appleButton}
              onPress={() => handleProvider('apple')}
            />
          )}
        </View>
      ) : (
        <Pressable
          style={[s.providerBtn, loadingProvider === 'apple' && s.providerBtnDisabled]}
          onPress={() => handleProvider('apple')}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'apple'
            ? <ActivityIndicator color={colors.text} />
            : <Text style={s.providerTxt}>Continue with Apple</Text>
          }
        </Pressable>
      )}

      <Pressable
        style={[s.providerBtn, loadingProvider === 'google' && s.providerBtnDisabled]}
        onPress={() => handleProvider('google')}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === 'google' ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={s.googleInner}>
            <AntDesign name="google" size={18} color="#4285F4" />
            <Text style={s.providerTxt}>Continue with Google</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  line: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerTxt: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.black,
    letterSpacing: 0.6,
  },
  providerBtn: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: Radius.sm,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  googleInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  providerBtnDisabled: {
    opacity: 0.65,
  },
  providerTxt: {
    color: colors.text,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  appleButtonWrap: {
    minHeight: 44,
  },
  appleButton: {
    height: 44,
    width: '100%',
  },
});
