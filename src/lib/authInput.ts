import type { TextInputProps } from 'react-native';

type CredentialField = 'username' | 'new-username' | 'email' | 'current-password' | 'new-password';

/** Use one native hint API per platform so the OS can recognize credential forms. */
export function authInputProps(field: CredentialField, platform: string): TextInputProps {
  const common: TextInputProps = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false };
  if (platform === 'ios') {
    const textContentType = field === 'current-password' ? 'password'
      : field === 'new-password' ? 'newPassword'
        : field === 'email' ? 'emailAddress' : 'username';
    return { ...common, textContentType };
  }
  const autoComplete = field === 'new-username'
    ? platform === 'android' ? 'username-new' : 'username'
    : field;
  return { ...common, autoComplete, ...(platform === 'android' ? { importantForAutofill: 'yes' } : {}) };
}

/** Navigation carries an email draft only; ambiguous or oversized params are ignored. */
export function resetEmailFromParam(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  return email.length <= 320 && !/[\r\n\u0000]/.test(email) ? email : '';
}
