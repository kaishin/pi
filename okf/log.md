# Bundle Update Log

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
