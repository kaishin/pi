# Plan

Fork of [earendil-works/pi](https://github.com/earendil-works/pi). This document tracks the big plans for this fork. Status: outline — details to be filled in as work starts.

## Goals

### 1. In-session model switching

Change the model mid-session without touching config files.

- [ ] Design the mechanism (session-scoped override, CLI command, UX)
- [ ] Implement
- [ ] Test

### 2. First-class plugins in-repo

Integrate the plugins we use directly into the repo for more control. Everything else stays installed as regular third-party extensions.

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

- [ ] Pick vendoring approach per plugin (copy into `packages/`, workspace packages, etc.)
- [ ] Vendor `pi-subagents`
- [ ] Vendor `pi-goal`
- [ ] Vendor `pi-tool-display`
- [ ] Vendor `pi-session-naming`
- [ ] Wire into the extension loader / default install
- [ ] Test

### 3. First-class agent support

Out-of-the-box support for agents — the delegation/autonomy layer, not just the runtime loop.

- [ ] Define scope: subagent workflows, goal mode, interplay with session model
- [ ] Design the integration with vendored plugins
- [ ] Implement
- [ ] Test

## Notes

- The third-party plugin inventory comes from `pi list` (user packages under `~/.pi/agent/npm/`).
- Many of the remaining third-party extensions could inform Goal 1 (providers) and Goal 3 (workflows) even if not built in.