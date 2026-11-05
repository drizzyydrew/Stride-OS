# iOS Password AutoFill association preparation

November 4, 2026. Origin and Apple association CDN now serve the exact payload.
Matching Expo/native entitlement configuration is staged. A newly signed binary
and physical-device save/update behavior remain unaccepted; build 111 is unchanged.

## What the screen changes establish

Sign-in fields identify the email as a username and the password as an existing
password. Sign-up and reset fields identify new passwords, and the reset form
shows the current allowed recovery-session email as account context. After a
successful update, the same authenticated owner can Continue without retyping
the password. No password is sent in navigation or persisted by these screens.

The native hints allow iOS to recognize the fields. Apple documents that the
key icon can access saved device credentials, while suggestions for a domain,
automatic strong-password generation and new-credential saving use an associated
domain. Hints alone do not complete that association or prove a save/update
prompt. The user's selected password provider, settings and consent still apply.

## Exact prepared payload and app identity

`password-autofill/apple-app-site-association` contains only:

```json
{
  "webcredentials": {
    "apps": ["QBAVJD9497.com.mooremovement.strideos"]
  }
}
```

The main host application's `application-identifier` was read directly from the
already extracted, signed QA112 artifact on November 4 using `codesign`:

- Application identifier: `QBAVJD9497.com.mooremovement.strideos`.
- Team identifier: `QBAVJD9497`.
- Associated-domains entitlement: absent.

Artifact: `/Users/drew/.cache/strideos-qa112-artifact-20261103/extracted/Payload/StrideOS.app`.
This verifies that archive's identifier; recheck the final candidate after any
signing/team change. Watch and extension identifiers are intentionally omitted
because they do not host these credential forms.

## Hosting and source configuration completed by the parent

The existing Vercel account now hosts only the association metadata in the
`strideos-password-association` project, ID `prj_vTtsKG8f6mVn7XKR7BKB1Vx9ktT1`.
Deployment `dpl_21GiGoCU3LGekAtAMEoDr1BGUBNn` is READY. The owned apex domain
`strideosfitness.com` had no project assignment and was bound to this project
with verified ownership and no redirect. No DNS record edit was needed.
Existing SMTP/auth subdomain records and the GitHub Pages website were unchanged.

Both `https://strideosfitness.com/.well-known/apple-app-site-association` and
Apple's `https://app-site-association.cdn-apple.com/a/v1/strideosfitness.com`
returned HTTP 200 with the exact main-app identifier. The origin is
`application/json`, valid HTTPS, without a redirect. Its compact deployed JSON
is semantically identical to the formatted payload in this folder.

`app.json` now includes `webcredentials:strideosfitness.com` in
`ios.associatedDomains`. Expo introspection confirmed the matching generated
`com.apple.developer.associated-domains` value. This is not a signed provisioning
or installed-device result. No new EAS build, TestFlight delivery, public app
release, paid service/plan change or credential rotation was performed.
Vercel deployment success is not proof of account-wide storage quota clearance.

## Validation sequence and remaining binary work

1. Choose an owner-controlled HTTPS host that can serve the exact path
   `/.well-known/apple-app-site-association` without authentication, redirects or
   an extension. This hosting step is now complete for `strideosfitness.com`.
   Serve the prepared JSON as `application/json` with a valid TLS certificate.
   SMTP/domain registration alone does not establish website hosting.
2. Read back the exact HTTPS URL and verify status 200, no redirect and the exact
   main-app identifier. Check the Apple association CDN response when available;
   allow for its cache/update delay. Do not claim device association from an
   origin-file check alone. Origin and CDN readbacks are now complete; device
   association remains open.
3. Only after host readback, stage the corresponding Expo iOS setting for the
   chosen host. For that candidate root domain the setting would be
   `"associatedDomains": ["webcredentials:strideosfitness.com"]`. No path,
   query, trailing slash or wildcard is needed. Source configuration and Expo
   entitlement introspection are now complete; signing capabilities and the
   final provisioning profile remain to be verified in a future native build.
4. A newly signed native candidate must contain the matching associated-domains
   entitlement and compatible provisioning. Verify its final signed entitlements;
   source configuration and an OTA JavaScript update cannot establish this.
5. On an installed candidate with Password AutoFill enabled, verify offered
   credentials, creation/save, password reset/update, cancellation and failed
   authentication. Record provider/settings and observed outcomes. Do not force
   a prompt or call it universal behavior.

The current GitHub Pages project path `/Stride-OS/` cannot be included in a
`webcredentials:` entitlement: the service binds a host, not a project path.
It is not a substitute for an association file at that host's required root path.
The external change is limited to the public association metadata and its host
assignment recorded above. No app submission or native installation occurred.

## Primary references

- [Apple Password AutoFill workflow](https://developer.apple.com/documentation/security/about-the-password-autofill-workflow)
- [Apple text-input credential semantics](https://developer.apple.com/documentation/security/enabling-password-autofill-on-a-text-input-view)
- [Apple associated-domain setup and file format](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [React Native 0.86 TextInput](https://reactnative.dev/docs/0.86/textinput)
