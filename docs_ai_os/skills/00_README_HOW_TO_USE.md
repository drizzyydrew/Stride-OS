# StrideOS Skills — How to Use

Reusable Claude Code/Codex prompts. Each skill is a single-purpose persona
kept deliberately narrow so invoking it costs as few tokens as possible —
prefer the smallest skill that covers the ask over one broad "do everything"
prompt.

## How to invoke

Paste the skill's Prompt Template as your message, filling in the brackets:

```text
Use docs_ai_os/skills/01_CODE_REVIEW_QA_SKILL.md.
Task: [describe feature/build]
Acceptance criteria: [list criteria]
```

```text
Use docs_ai_os/skills/02_FIX_AND_ITERATE_SKILL.md.
Task: [feature/fix]
Design reference: docs/design/v3/[file]
Acceptance criteria: [criteria]
```

```text
Use docs_ai_os/skills/03_BUILD_IOS_SKILL.md.
Build number: [next number]
```

## Standard confidence rule

Only build (03) or submit (05) when confidence is **≥95%**, based on:
- acceptance criteria satisfied (or explicitly out of scope)
- diff scoped to the task
- `npm run typecheck`, `npm run expo:check`, `git diff --check` all clean
- protected systems untouched — see `07_SCOPE_GUARD_SKILL.md`
- no unresolved blocker
- screenshots/device evidence when available, or the limitation stated
  plainly per `06_SCREENSHOT_VISUAL_QA_SKILL.md`

If confidence is below 95%: stop, do not build or submit, report the exact
smallest next fix. This is a complete, valid outcome for the turn — not a
failure to push through.

## This sandbox, specifically

- No iOS Simulator (`simctl`) and no browser-automation tool are typically
  installed. Don't assume otherwise — check each time (`06`).
- `eas build` / `eas submit` need `--non-interactive` here (no TTY for
  credential prompts) — see `03` and `05`. Note the deviation if the
  human's own command didn't include the flag.
