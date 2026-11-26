# StrideOS website hosting

The public website source is the `docs/` folder on
`claude/stride-os-visibility-sxl7xl`. GitHub Pages remains available at
https://drizzyydrew.github.io/Stride-OS/.

Cloudflare application: `strideos-website`. The dedicated account belongs to
`strideosfitness@gmail.com`, account `049b18a987ad6622853eea826657be82`.
Its current public address is:
https://strideos-website.strideos-website-transfer-20261126.workers.dev/.

Use the dedicated StrideOS authorization when deploying from this branch:

```sh
XDG_CONFIG_HOME="$HOME/.config/strideos-cloudflare" wrangler deploy --no-autoconfig --config wrangler.jsonc
```

That authentication directory is local and must not be committed. Credentials
are encrypted with a key held in macOS Keychain. The default Wrangler login
continues to belong to Bet Desk; this configuration intentionally requires the
separate StrideOS account. Do not change the account ID to work around an
authorization error.

This deploys static files only. It does not build or submit the iOS app, run
backend functions, or synchronize automatically on every GitHub push. Do not
copy this configuration onto the native app branch: its `docs/` folder includes
internal handoff material that does not belong on the website.

`docs/.well-known/apple-app-site-association` preserves the existing password-
autofill association. `_headers` serves it as JSON. Check HTTP 200, no redirect
or authentication, and the expected app identifier after deployment. Verify the
home, privacy, terms, support and linked assets by content readback.

On November 26, 2026, public HTTPS readback on the dedicated StrideOS account
matched all 16 checked pages/assets, including the Apple association endpoint.
The new account does not require the Bet Desk account's Access exception.
The version verified was `d85b1a71-effb-4de9-8535-32bcba1e61ae`.

On November 26, 2026, the domain was added to the dedicated Cloudflare account
on the Free plan. The authentication email CNAME and TXT records were imported
and checked against the Vercel backup. Exact-host Worker routes now map
`strideosfitness.com/*` and `www.strideosfitness.com/*` to this static website.
The existing proxied website DNS records remain; the Worker serves matching
requests before they reach the previous host. Keep these routes in the deployment
configuration.

Vercel accepted the registrar nameserver update to `hank.ns.cloudflare.com` and
`vita.ns.cloudflare.com`. Acceptance does not establish propagation or HTTPS
readiness: verify the public domain, linked assets, authentication email DNS and
Apple association endpoint after activation. Preserve existing GitHub Pages URLs
and the pending Apple submission. Do not disable protections for Bet Desk
applications or upgrade any paid plan as part of this move.
