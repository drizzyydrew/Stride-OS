# URI Decoder Compatibility

Expo Router 56 uses query-string 7, which requires a callable CommonJS decoder.
Upstream decode-uri-component 0.5.1 fixes GHSA-vcc3-ghjq-m6fr and
GHSA-qr28-fpjm-wq7f but exports ESM. This adapter changes only the export shape;
all decoding is performed by the exact pinned upstream package, not a fork.
The upstream package retains its own license. Node requires 20.19 or newer;
Metro handles the ESM default export in the native bundle.

Remove this adapter when the SDK-compatible Router no longer needs query-string
7. Keep the runtime, Metro-bundle, adversarial-input and dependency tests when
updating either dependency. Do not change the adapter version to conceal an
advisory; the installed upstream package must also pass the audit.
