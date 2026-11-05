import { requireOptionalNativeModule } from 'expo-modules-core';

export default function getCredentialAutofillModule() {
  return requireOptionalNativeModule<{ commitAsync(): Promise<boolean> }>('StrideCredentialAutofill');
}
