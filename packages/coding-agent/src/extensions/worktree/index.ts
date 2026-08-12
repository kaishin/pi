import type { ExtensionAPI } from "../../core/extensions/types.ts";
import { registerWorktreeCommand } from "./command.ts";
import { createWorktreeSettingsRuntime, settingsFilePath, type WorktreeSettingsRuntime } from "./settings.ts";

interface WorktreeExtensionOptions {
	settings?: WorktreeSettingsRuntime;
}

export default function worktreeExtension(pi: ExtensionAPI, options: WorktreeExtensionOptions = {}): void {
	const settings = options.settings ?? createWorktreeSettingsRuntime({ path: settingsFilePath });
	registerWorktreeCommand(pi, settings);

	pi.on("session_start", async (_event, ctx) => {
		const loaded = await settings.reload();
		if (!loaded.warning || !ctx.hasUI) return;
		ctx.ui.notify(loaded.warning, "warning");
	});
	pi.on("session_shutdown", async () => {
		await settings.flush?.();
	});
}
