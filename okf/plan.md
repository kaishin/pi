---
type: plan
title: Fork Plan
description: "Goals and status for the kaishin/pi fork of earendil-works/pi: session-scoped model switching, vendored plugins, and first-class agent support."
resource: /Users/kaishin/Developer/Cloned/pi/PLAN.md
tags: [fork, plan, model-switching, plugins, agents]
timestamp: 2026-08-08T19:37:24Z
---

# Fork Plan

Fork of [earendil-works/pi](https://github.com/earendil-works/pi) at
`kaishin/pi`. This page tracks the big plans for the fork. The working copy
lives at `/PLAN.md` in the repo root; this concept document mirrors it for the
OKF bundle.

## Goal 1: In-session model switching

Change the model mid-session without touching config files.

**Status: implemented and verified.**

- `/model`, Ctrl+P cycling, and the model selector no longer write to settings.
  Only `agent.state.model` and session history change
  (`packages/coding-agent/src/core/agent-session.ts`).
- Explicit persistence path added: `pi config set-model
  <provider>/<model> [-l|--local]` (writes the persisted default via
  `SettingsManager.setDefaultModelAndProvider(..., scope)`).
- Verified with `./pi-test.sh`: session switches leave `settings.json`
  untouched; Homebrew pi 0.84.1 (old behavior) still persists on switch.
- Committed as `11fd5175f`.

## Goal 2: First-class plugins in-repo

Integrate the plugins we use directly into the repo for more control.
Everything else stays installed as regular third-party extensions.

**Built in (vendored in-repo):**

- ~~`pi-subagents`~~ — **tried and abandoned (2026-08-10).** It was vendored, reshaped
  to a 4-agent set and debugged through a day of manual testing; the delegation UX
  was not usable enough to keep. The work is preserved on the
  `subagents-vendoring-archive` branch. Do not re-vendor without deciding to
  revisit it.
- `pi-goal` — persistent autonomous goals (`/goal`). **Vendored (2026-08-11)** with its
  session-scoped `/goal` lifecycle, continuation, token budgets, footer status, and goal tools.
  The `pi-goal-writer` skill was deliberately not bundled: it is authoring guidance rather than
  runtime behavior and would require standalone asset discovery. This does not define or expand
  Goal 3.
- `pi-tool-display` — compact tool-call rendering. **Vendored (2026-08-11)** as the minimal
  in-core implementation: built-in tool summaries, collapsible output, colored edit diffs, and
  bordered user messages. Its settings UI, configuration API, debug logger, npm postinstall,
  and example asset were deliberately dropped; `npm:pi-tool-display` was removed from user
  settings to prevent collisions.
- `pi-session-naming` (`@furbyhaxx/pi-session-naming`) — session titles/renaming/browsing.
  **Vendored (2026-08-11)** into `packages/coding-agent/src/extensions/session-naming/`.
  Prompt templates are inlined as TS constants rather than shipped as `.md` assets, so the
  Bun binary works without touching `copy-assets`. The upstream test suite was ported to
  vitest as `test/session-naming-*.test.ts`.

**Stay third-party:**

- `@sinamtz/pi-minimax-provider` (providers)
- `pi-mcp-adapter`, `betterwright`, `pi-cmux`, `@narumitw/pi-worktree` (tool integrations)
- `pi-btw`, `pi-okf`, `@juicesharp/rpiv-todo` (workflows)
- `@kaishin/pi-bar` (status bar)

## Goal 3: First-class agent support

Out-of-the-box support for agents — the delegation/autonomy layer, not just the
runtime loop. Scope: goal mode and interplay with session model. Subagent
workflows are **out of scope** after the pi-subagents attempt was abandoned; any
future delegation work starts from a fresh decision, not from that branch.

## Notes

- The third-party plugin inventory comes from `pi list` (user packages under
  `~/.pi/agent/npm/`).
- Many remaining third-party extensions could inform Goal 1 (providers) and
  Goal 3 (workflows) even if not built in.
