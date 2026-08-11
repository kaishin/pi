import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "../src/core/extensions/types.ts";
import toolDisplayExtension, { toolDisplayTestUtils } from "../src/extensions/tool-display/index.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

describe("tool display helpers", () => {
	it("extracts text output blocks into display lines", () => {
		expect(
			toolDisplayTestUtils.outputLines({
				content: [
					{ type: "text", text: "first\r\nsecond" },
					{ type: "image", data: "ignored" },
					{ type: "text", text: "third" },
				],
			}),
		).toEqual(["first", "second", "third"]);
	});

	it("uses file_path when path is absent", () => {
		expect(toolDisplayTestUtils.pathOrPlaceholder({ file_path: "src/example.ts" })).toBe("src/example.ts");
		expect(toolDisplayTestUtils.pathOrPlaceholder({})).toBe("…");
	});

	it("registers compact renderers for every built-in tool", () => {
		const names: string[] = [];
		toolDisplayExtension({
			registerTool(tool: { name: string }) {
				names.push(tool.name);
			},
		} as unknown as ExtensionAPI);
		expect(names).toEqual(["read", "grep", "find", "ls", "bash", "edit", "write"]);
	});

	it("renders user messages in a bordered box", () => {
		initTheme("dark");
		const output = new UserMessageComponent("hello").render(20).join("\n");
		expect(output).toContain("╭");
		expect(output).toContain("╯");
	});
});
