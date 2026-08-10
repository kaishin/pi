import type { ExtensionAPI } from "../../core/extensions/types.ts";
import { registerSessionAutoTitle } from "./auto-title.ts";
import { DEFAULT_PI_CONFIG, loadPiConfig } from "./config.ts";
import { registerSessionList } from "./list.ts";
import { registerSessionRename } from "./rename.ts";
import { registerSessionTitleMessageRenderer } from "./title-message.ts";

async function loadConfig() {
	try {
		return (await loadPiConfig(process.cwd())).config;
	} catch {
		return DEFAULT_PI_CONFIG;
	}
}

export default async function sessionExtension(pi: ExtensionAPI): Promise<void> {
	const config = await loadConfig();
	registerSessionTitleMessageRenderer(pi);
	await registerSessionList(pi);
	await registerSessionRename(pi);
	registerSessionAutoTitle(pi, config);
}
