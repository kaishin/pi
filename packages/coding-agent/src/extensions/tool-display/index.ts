import { Text } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ToolRenderResultOptions } from "../../core/extensions/types.ts";
import { createToolDefinition, type ToolName } from "../../core/tools/index.ts";
import type { Theme } from "../../modes/interactive/theme/theme.ts";

function textResult(text: string): Text {
	return new Text(text, 0, 0);
}

function toRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function getText(value: unknown, key: string): string | undefined {
	const field = toRecord(value)[key];
	return typeof field === "string" && field.length > 0 ? field : undefined;
}

function outputLines(result: unknown): string[] {
	const content = toRecord(result).content;
	if (!Array.isArray(content)) {
		return [];
	}

	return content
		.flatMap((block) => {
			const record = toRecord(block);
			return record.type === "text" && typeof record.text === "string"
				? record.text.replace(/\r/g, "").split("\n")
				: [];
		})
		.filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
}

function previewOutput(result: unknown, options: ToolRenderResultOptions, theme: Theme, maxLines = 5): Text {
	const lines = outputLines(result);
	if (lines.length === 0) {
		return textResult(theme.fg("muted", "↳ (no output)"));
	}

	const shown = options.expanded ? lines : lines.slice(0, maxLines);
	let text = shown.map((line) => theme.fg("toolOutput", line)).join("\n");
	if (!options.expanded && lines.length > shown.length) {
		text += `\n${theme.fg("muted", `… (${lines.length - shown.length} more lines · Ctrl+O to expand)`)}`;
	}
	return textResult(text);
}

function renderDiff(result: unknown, options: ToolRenderResultOptions, theme: Theme): Text {
	const details = toRecord(toRecord(result).details);
	const diff = getText(details, "diff") ?? getText(details, "patch");
	if (!diff) {
		return previewOutput(result, options, theme, 24);
	}

	const lines = diff.replace(/\r/g, "").split("\n");
	const shown = options.expanded ? lines : lines.slice(0, 24);
	let text = shown
		.map((line) => {
			if (line.startsWith("+") && !line.startsWith("+++")) {
				return theme.fg("success", line);
			}
			if (line.startsWith("-") && !line.startsWith("---")) {
				return theme.fg("error", line);
			}
			return theme.fg("muted", line);
		})
		.join("\n");
	if (!options.expanded && lines.length > shown.length) {
		text += `\n${theme.fg("muted", `… (${lines.length - shown.length} more lines · Ctrl+O to expand)`)}`;
	}
	return textResult(text);
}

function pathOrPlaceholder(args: unknown): string {
	return getText(args, "path") ?? getText(args, "file_path") ?? "…";
}

function renderCall(name: ToolName, args: unknown, theme: Theme): Text {
	const path = pathOrPlaceholder(args);
	switch (name) {
		case "bash":
			return textResult(
				`${theme.fg("toolTitle", theme.bold("$"))} ${theme.fg("accent", getText(args, "command") ?? "…")}`,
			);
		case "grep":
			return textResult(
				`${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", getText(args, "pattern") ?? "…")} ${theme.fg("muted", path)}`,
			);
		case "find":
			return textResult(
				`${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", getText(args, "pattern") ?? "…")} ${theme.fg("muted", path)}`,
			);
		case "ls":
			return textResult(`${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", path)}`);
		case "edit": {
			const edits = toRecord(args).edits;
			const count = Array.isArray(edits) ? edits.length : 0;
			return textResult(
				`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path)}${theme.fg("muted", ` (${count} ${count === 1 ? "edit" : "edits"})`)}`,
			);
		}
		case "write": {
			const content = getText(args, "content") ?? "";
			const lines = content ? content.replace(/\r/g, "").split("\n").length : 0;
			return textResult(
				`${theme.fg("toolTitle", theme.bold("write"))} ${theme.fg("accent", path)}${theme.fg("muted", ` (${lines} ${lines === 1 ? "line" : "lines"})`)}`,
			);
		}
		case "read":
			return textResult(`${theme.fg("toolTitle", theme.bold("read"))} ${theme.fg("accent", path)}`);
	}
}

function renderResult(name: ToolName, result: unknown, options: ToolRenderResultOptions, theme: Theme): Text {
	if (name === "edit") {
		return renderDiff(result, options, theme);
	}
	if (name === "read" || name === "grep" || name === "find" || name === "ls") {
		const lineCount = outputLines(result).length;
		return options.expanded
			? previewOutput(result, options, theme)
			: textResult(
					theme.fg("muted", `↳ ${lineCount} ${lineCount === 1 ? "line" : "lines"} returned · Ctrl+O to expand`),
				);
	}
	return previewOutput(result, options, theme);
}

/**
 * Compact rendering for Pi's built-in tools.
 *
 * This intentionally keeps only the always-visible behavior from pi-tool-display:
 * tool summaries, collapsible output, and colored edit diffs. Configuration UI,
 * extension-to-extension APIs, and extension-directory assets stay out of core.
 */
export default function toolDisplayExtension(pi: ExtensionAPI): void {
	for (const name of ["read", "grep", "find", "ls", "bash", "edit", "write"] as const) {
		const base = createToolDefinition(name, process.cwd());
		pi.registerTool({
			...base,
			renderCall: (args, theme) => renderCall(name, args, theme),
			renderResult: (result, options, theme) => renderResult(name, result, options, theme),
		});
	}
}

export const toolDisplayTestUtils = { outputLines, pathOrPlaceholder, renderCall };
