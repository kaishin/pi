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

- `pi-subagents` — single-agent delegation and scripted multi-agent workflows
- `pi-goal` — persistent autonomous goals (`/goal`)
- `pi-tool-display` — compact tool-call rendering
- `pi-session-naming` (`@furbyhaxx/pi-session-naming`) — session titles/renaming/browsing

**Stay third-party:**

- `@sinamtz/pi-minimax-provider`, `pi-claude-bridge` (providers)
- `pi-mcp-adapter`, `betterwright`, `pi-cmux`, `@narumitw/pi-worktree` (tool integrations)
- `pi-btw`, `pi-plan`, `pi-okf`, `@juicesharp/rpiv-todo` (workflows)
- `@kaishin/pi-bar` (status bar)

## Goal 3: First-class agent support

Out-of-the-box support for agents — the delegation/autonomy layer, not just the
runtime loop. Scope: subagent workflows, goal mode, interplay with session
model; built on the vendored plugins from Goal 2.

## Notes

- The third-party plugin inventory comes from `pi list` (user packages under
  `~/.pi/agent/npm/`).
- Many remaining third-party extensions could inform Goal 1 (providers) and
  Goal 3 (workflows) even if not built in.