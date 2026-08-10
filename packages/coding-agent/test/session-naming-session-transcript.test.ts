import { describe, expect, it } from "vitest";
import {
	buildSessionTranscriptBlock,
	formatSessionTranscript,
} from "../src/extensions/session-naming/session-transcript.ts";

const branch = [
	{ type: "custom", customType: "ignored", data: {} },
	{ type: "message", message: { role: "user", content: "first user" } },
	{ type: "message", message: { role: "toolResult", toolName: "read", content: "file contents" } },
	{ type: "message", message: { role: "assistant", content: "assistant reply" } },
	{ type: "message", message: { role: "toolResult", toolName: "bash", content: "test output" } },
	{
		type: "message",
		message: {
			role: "user",
			content: [
				{ type: "thinking", thinking: "ignored" },
				{ type: "text", text: "latest user" },
			],
		},
	},
] as any[];

describe("formatSessionTranscript", () => {
	it("includes every message and tool result when unbounded", () => {
		expect(formatSessionTranscript(branch, { maxMessageCount: -1, includeTools: true })).toBe(
			[
				"[user] first user",
				"[tool:read] file contents",
				"[assistant] assistant reply",
				"[tool:bash] test output",
				"[user] latest user",
			].join("\n"),
		);
	});

	it("drops tool results when includeTools is false", () => {
		expect(formatSessionTranscript(branch, { maxMessageCount: 0, includeTools: false })).toBe(
			["[user] first user", "[assistant] assistant reply", "[user] latest user"].join("\n"),
		);
	});

	it("keeps the last N entries when bounded", () => {
		expect(formatSessionTranscript(branch, { maxMessageCount: 2, includeTools: true })).toBe(
			["[tool:bash] test output", "[user] latest user"].join("\n"),
		);
	});

	it("applies the bound after filtering out tool results", () => {
		expect(formatSessionTranscript(branch, { maxMessageCount: 2, includeTools: false })).toBe(
			["[assistant] assistant reply", "[user] latest user"].join("\n"),
		);
	});
});

describe("buildSessionTranscriptBlock", () => {
	it("wraps the transcript in a tag", () => {
		expect(buildSessionTranscriptBlock(branch, { maxMessageCount: 1, includeTools: false })).toBe(
			"<session-transcript>\n[user] latest user\n</session-transcript>",
		);
	});

	it("returns undefined for an empty branch", () => {
		expect(buildSessionTranscriptBlock([], { maxMessageCount: -1, includeTools: true })).toBeUndefined();
	});
});
