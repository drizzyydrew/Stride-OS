# StrideOS website and support preparation

The existing free support URL is updated and verified live:
https://drizzyydrew.github.io/Stride-OS/support.html

## Published changes

- Added newest-link password-reset guidance without requesting private reset links.
- Added goal archive and optional open-training guidance, distinguishing a closed
  training block from a completed race.
- Added optional AI-sharing guidance and corrected automatic-coaching implications.
- Narrowed training-zone language to estimates and source/method labels.
- Added semantic FAQ headings, a keyboard skip link and visible focus styling.
- Fixed mobile footer overflow and contact-email wrapping. Removed remote font
  requests; no analytics, scripts, forms or extra services were added.

Canonical support/brief source commit: `13253ca`. The separate existing Pages
branch `claude/stride-os-visibility-sxl7xl` changed only `docs/support.html` in
`868ef32cf74a4eacc20d5b7433e430ef64cf7dd1`. Its build reports built with no error.
Uncached HTTPS GET returned HTTP 200 and exact equality to reviewed source,
SHA-256 `ab9b2ffb9c6347e09a6de467917fc1bad45ce0d0254be190fbadbba1ca0d7673`.
The live browser shows the updated FAQ headings and content.

## Verification

At viewport widths 320, 393, 768 and 1160, document width equaled viewport width
with no horizontal overflow. The first 320px pass exposed the historical footer
overflow; wrapping was corrected before the final passing checks and publication.
All relative link targets exist, there are twelve FAQ headings under one H1/H2,
and keyboard activation of Skip to support moves focus to the main region.
There are no remote embedded resources, scripts or forms in the source.
These checks are a bounded website review, not full accessibility certification.

Live screenshot: `/tmp/strideos-support-live-20261103.png`.
Local preview was closed and temporary viewport override reset after review.
No native source changed, so no additional app build or native regression run
was needed for this website/documentation change.

## Private preparation

`LAUNCH_SUPPORT_PLAYBOOK.md` contains case intake, issue handling, draft response
templates and release support checks. `INDEPENDENT_REVIEW_BRIEF.md` defines a
bounded engineering/device review, deliverables, access limits and a separately
quoted legal review. Both remain repository handoff documents, not website pages
or messages sent to reviewers. No reviewer was hired or service purchased.

Public app release and billing remain off; device, purchase and actual provider
deletion acceptance remain open. Existing free website URLs are preserved.
