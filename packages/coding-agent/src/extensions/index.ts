import type { InlineExtension } from "../core/extensions/types.ts";
import llamaExtension from "./llama/index.ts";
import sessionNamingExtension from "./session-naming/index.ts";
import toolDisplayExtension from "./tool-display/index.ts";

export const builtInExtensions: InlineExtension[] = [
	{ name: "llama.cpp", factory: llamaExtension, hidden: true },
	{ name: "session-naming", factory: sessionNamingExtension },
	{ name: "tool-display", factory: toolDisplayExtension },
];
