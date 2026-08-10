# Bundle Update Log

## 2026-08-10

* **Session: pi-subagents vendoring abandoned** (2026-08-10)
  * **Summary**: pi-subagents was vendored, reshaped to a 4-agent set, wired for dist and binary builds, given native slash commands and decoupled from its built-in agent names — then removed from main. A day of manual testing showed the delegation UX was not usable enough to keep. The 11 commits are preserved on the `subagents-vendoring-archive` branch.
  * **Decisions**:
    * Goal 2 no longer includes pi-subagents; do not re-vendor it without an explicit decision to revisit
    * Goal 3 (first-class agent support) drops subagent workflows from scope and keeps goal mode and session-model interplay
    * The pi config stays stripped: npm:pi-subagents, npm:pi-plan and npm:pi-intercom remain uninstalled and pi-switch.ts stays deleted
    * The dev-* agent files in ~/.pi/agent/agents/ are left in place but nothing loads them
  * **Why it was abandoned**:
    * Design faults only surfaced in real runs: prompt bodies addressed the parent rather than the child and discarded $ARGUMENTS, and effort did not scale to the request — answering "what is the cwd" cost 46 tool calls, 87k tokens and five minutes
    * A subagent asking its supervisor a question surfaced to the user as a failed workflow rather than a prompt to reply
    * The running spinner never animated on the surface that mattered, because the foreground renderer receives no TUI handle
    * Three installed plugins conflicted: npm:pi-subagents duplicated the built-in tools (a hard extension load error), pi-plan claimed /plan, and pi-intercom displaced the native supervisor channel
    * A leftover `subagents.disableBuiltins: true` silently hid every built-in agent, so nothing worked until it was found
    * Each fix was sound in isolation, but the rate of newly surfaced issues did not fall
  * **Changes**:
    * main reset to d4088e960; packages/coding-agent/src/extensions/ holds only index.ts and llama again
    * Work archived on subagents-vendoring-archive (includes two fixes that were not subagent-specific: the "private": true artifact-packaging false positive, and the clock-derived spinner frame)
    * PLAN.md and okf/plan.md mark pi-subagents abandoned and rescope Goal 3
  * **Open questions**:
    * ~~Do pi-goal, pi-tool-display and pi-session-naming still warrant vendoring?~~ **Resolved 2026-08-10: yes, all three remain in scope for Goal 2.** The pi-subagents outcome is specific to that plugin, not an argument against vendoring.
    * If delegation is revisited, does it start from upstream again or from a design of our own?

## 2026-08-08

* **Session: In-session model switching shipped** (2026-08-08T19:39:24.923Z)
  * **Summary**: Goal 1 (session-scoped model switching) implemented, committed, and verified: /model and cycling no longer write settings; pi config set-model is the explicit persistence path. Plan moved into the OKF bundle.
  * **Decisions**:
    * Model switching (/model, Ctrl+P, selector) is session-scoped: only agent.state.model + session history change, never settings.json
    * Explicit persistence path is pi config set-model <provider>/<model> [-l|--local] with model validation against the runtime
    * The okf/ bundle is the canonical home for the fork plan; PLAN.md at repo root remains the working source
    * Four plugins to vendor in-repo later: pi-subagents, pi-goal, pi-tool-display, pi-session-naming; the rest stay third-party
  * **Changes**:
    * Removed settingsManager.setDefaultModelAndProvider from agent-session.ts setModel/_cycleScopedModel/_cycleAvailableModel and model-selector.ts
    * Added scope param (global|project) to SettingsManager.setDefaultModelAndProvider
    * Added config set-model subcommand in package-manager-cli.ts with runtime validation and 15s catalog bound
    * Committed 11fd5175f; regenerated ai model data (image-models.generated.ts)
    * Created okf/plan.md concept doc and regenerated okf/index.md
  * **Open questions**:
    * Should a bare /okf-capture in pi-okf delegate to the session via sendUserMessage instead of writing a placeholder (fix pending in kaishin/pi-okf)?
    * Keep PLAN.md at repo root once okf/plan.md is canonical, or reduce it to a pointer?

* **Session: Session capture** (2026-08-08T18:51:49.051Z)
  * **Summary**: Session capture invoked from /okf-capture at 2026-08-08T18:51:49.051Z. Add decisions, changes, and questions by calling the okf_capture tool.
