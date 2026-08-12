# Plan

Fork of [earendil-works/pi](https://github.com/earendil-works/pi). This document tracks the big plans for this fork. Status: outline — details to be filled in as work starts.

## Goals

### 1. In-session model switching

Change the model mid-session without touching config files.

- [x] Design the mechanism (session-scoped override, CLI command, UX)
- [x] Implement — `/model`, Ctrl+P cycling, and the model selector no longer write to settings; only `agent.state.model` + session history change
- [x] Add explicit persistence path: `pi config set-model <provider>/<model> [-l|--local]`
- [x] Test — verified with `./pi-test.sh`: session switches leave `settings.json` untouched; Homebrew pi 0.84.1 (old behavior) still persists
- [x] Committed as `11fd5175f`

### 2. First-class plugins in-repo

Integrate the plugins we use directly into the repo for more control. Everything else stays installed as regular third-party extensions.

**Built in (vendored in-repo):**
- ~~`pi-subagents`~~ — **tried and abandoned (2026-08-10).** Vendored, reshaped to 4 agents
  and debugged for a day; the UX did not hold up. See the `subagents-vendoring-archive`
  branch. Do not re-vendor without a decision to revisit.
- `pi-goal` — persistent autonomous goals (`/goal`)
- `pi-tool-display` — compact tool-call rendering
- `pi-session-naming` (`@furbyhaxx/pi-session-naming`) — session titles/renaming/browsing
- `pi-bar` footer — fixed editorial footer with activity, usage, context, model, git, and statuses
- `pi-worktree` (`@narumitw/pi-worktree`) — safe Git worktree management and workspace switching

**Stay third-party:**
- `@sinamtz/pi-minimax-provider` (providers)
- `pi-mcp-adapter`, `betterwright`, `pi-cmux` (tool integrations)
- `pi-btw`, `pi-okf`, `@juicesharp/rpiv-todo` (workflows)

- [x] Pick vendoring approach per plugin — copy the source into
      `packages/coding-agent/src/extensions/<name>/`, rewrite package-name imports to relative
      internal paths, inline any file assets as TS constants, and register the factory in
      `builtInExtensions`
- [x] ~~Vendor `pi-subagents`~~ — abandoned, see above
- [x] Vendor `pi-goal` — session-scoped `/goal` persistence, continuation, token budgets,
      status, and goal tools are built in. The goal-writer skill was not bundled because it is
      authoring guidance rather than runtime behavior and needs standalone asset discovery.
- [x] Vendor `pi-tool-display` — compact built-in tool summaries, collapsible output, colored edit
      diffs, and bordered user messages are now in core. The settings UI, configuration API,
      debug logger, npm postinstall, and example asset were deliberately not carried over;
      `npm:pi-tool-display` was removed from user settings to prevent collisions.
- [x] Vendor `pi-session-naming` — 14 modules under
      `packages/coding-agent/src/extensions/session-naming/`; the two prompt templates are
      inlined in `prompts.ts` so the standalone binary needs no asset wiring; its own test
      suite ported to vitest (7 files, 97 tests); `npm:@furbyhaxx/pi-session-naming` removed
      from user settings so `/sessions`, `/rename`, and `--list-sessions` do not collide
- [x] Wire into the extension loader / default install
- [x] Vendor the configured `pi-bar` footer — its active footer segments are built in; the menu,
      configuration, shortcut, session transcript entry, and other package behavior were not carried over
- [x] Vendor `pi-worktree` — Git safety checks, worktree sessions, root settings, and all five flows
      are built in; the external searchable menu was intentionally replaced by standard Pi selectors and
      status-detail notifications, avoiding `@narumitw/pi-tui-kit`.
- [x] Test — focused vitest coverage for renderer registration and helper behavior, plus the
      existing user-message rendering tests

### 3. First-class agent support

Out-of-the-box support for agents — the delegation/autonomy layer, not just the runtime loop.

- [ ] Define scope: goal mode, interplay with session model (subagent workflows are out of
      scope after the pi-subagents attempt was abandoned)
- [ ] Design the integration with vendored plugins
- [ ] Implement
- [ ] Test

## Notes

- The third-party plugin inventory comes from `pi list` (user packages under `~/.pi/agent/npm/`).
- Many of the remaining third-party extensions could inform Goal 1 (providers) and Goal 3 (workflows) even if not built in.
