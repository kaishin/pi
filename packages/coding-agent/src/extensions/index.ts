import type { InlineExtension } from "../core/extensions/types.ts";
import barFooterExtension from "./bar-footer/index.ts";
import goalExtension from "./goal/index.ts";
import llamaExtension from "./llama/index.ts";
import minimaxExtension from "./minimax/index.ts";
import sessionNamingExtension from "./session-naming/index.ts";
import todoExtension from "./todo/index.ts";
import toolDisplayExtension from "./tool-display/index.ts";
import worktreeExtension from "./worktree/index.ts";

export const builtInExtensions: InlineExtension[] = [
	{ name: "bar-footer", factory: barFooterExtension },
	{ name: "llama.cpp", factory: llamaExtension, hidden: true },
	{ name: "minimax", factory: minimaxExtension },
	{ name: "goal", factory: goalExtension },
	{ name: "session-naming", factory: sessionNamingExtension },
	{ name: "tool-display", factory: toolDisplayExtension },
	{ name: "todo", factory: todoExtension },
	{ name: "worktree", factory: worktreeExtension },
];
