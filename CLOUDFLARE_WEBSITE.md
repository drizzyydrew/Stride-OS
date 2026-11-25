# StrideOS website hosting

The public website source is the `docs/` folder on
`claude/stride-os-visibility-sxl7xl`. GitHub Pages remains available at
https://drizzyydrew.github.io/Stride-OS/.

Cloudflare application: `strideos-website`, account
`81480b7800ef605176e4e5c43fb16138`. The generated Cloudflare URL is
https://strideos-website.betdeskhq.workers.dev/.

Deploy from this branch with an authenticated Wrangler installation:

```sh
wrangler deploy --config wrangler.jsonc
```

This deploys static files only. It does not build or submit the iOS app, run
backend functions, or synchronize automatically on each GitHub push.
Do not deploy the native app branch with this configuration: its `docs/`
folder contains internal handoff material that does not belong on the website.

`docs/.well-known/apple-app-site-association` preserves the app's existing
password-autofill association. `_headers` serves it as JSON. Verify HTTP 200,
no redirect or authentication, and the expected app identifier after deployment.
Verify the home, privacy, terms, support, and linked assets by content readback.

As of the first migration upload on November 25, 2026, Cloudflare account-level
Access still protects the new application and the custom domain still points
to the paused Vercel host. Deployment success alone does not establish public
availability. The remaining cutover requires a public exception scoped to this
website, importing the existing email/DNS records into Cloudflare, connecting
the custom domain, and updating the domain nameservers at its registrar.

Preserve authentication email DNS records, existing GitHub Pages URLs, all
website content, and the pending Apple submission. Do not disable Access for
other Cloudflare applications or upgrade any paid plan as part of this move.
