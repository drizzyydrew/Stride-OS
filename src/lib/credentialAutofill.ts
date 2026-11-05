import { Keyboard, Platform } from 'react-native';
import getCredentialAutofillModule from '../../modules/stride-credential-autofill/src/StrideCredentialAutofillModule';

/** After successful credential submission only. No credentials are accepted,
 * stored, logged or transmitted by this helper. The OS/provider controls UI. */
export async function finishCredentialAutofill(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await getCredentialAutofillModule()?.commitAsync();
    } else if (Platform.OS === 'ios') {
      Keyboard.dismiss();
    }
  } catch {
    // An unavailable/disabled password manager must not undo a successful login.
  }
}
