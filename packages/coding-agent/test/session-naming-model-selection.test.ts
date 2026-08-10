import { describe, expect, it } from "vitest";
import {
	isAutoTitleModelValue,
	parseTitleModelRef,
	pickAutoTitleModel,
	shouldSkipAutoTitleCandidateForContext,
} from "../src/extensions/session-naming/model-selection.ts";

describe("isAutoTitleModelValue", () => {
	it.each([undefined, "", "auto"])("treats %j as automatic", (value) => {
		expect(isAutoTitleModelValue(value)).toBe(true);
	});

	it("treats any other value as an explicit model reference", () => {
		expect(isAutoTitleModelValue(" inherit ")).toBe(false);
	});
});

describe("parseTitleModelRef", () => {
	it("parses provider, id, and thinking level", () => {
		expect(parseTitleModelRef("deepseek/deepseek-v4-flash:high")).toEqual({
			provider: "deepseek",
			id: "deepseek-v4-flash",
			thinking: "high",
		});
	});

	it("parses a reference without a thinking level", () => {
		expect(parseTitleModelRef("github-copilot/gpt-5.4-mini")).toEqual({
			provider: "github-copilot",
			id: "gpt-5.4-mini",
			thinking: undefined,
		});
	});

	it("falls back to the default provider when none is given", () => {
		expect(parseTitleModelRef("gpt-5.4-mini:low", "github-copilot")).toEqual({
			provider: "github-copilot",
			id: "gpt-5.4-mini",
			thinking: "low",
		});
	});

	it.each([
		["the auto sentinel", "auto"],
		["a missing model id", "deepseek/"],
		["an unknown thinking level", "deepseek/deepseek-v4-flash:huge"],
	])("returns undefined for %s", (_label, value) => {
		expect(parseTitleModelRef(value)).toBeUndefined();
	});
});

describe("shouldSkipAutoTitleCandidateForContext", () => {
	it("ignores the context window unless the check is forced", () => {
		expect(
			shouldSkipAutoTitleCandidateForContext({
				forceCurrentContextCheck: false,
				currentContextTokens: 500_000,
				candidateContextWindow: 128_000,
			}),
		).toBe(false);
	});

	it("skips a candidate that cannot hold the current context", () => {
		expect(
			shouldSkipAutoTitleCandidateForContext({
				forceCurrentContextCheck: true,
				currentContextTokens: 500_000,
				candidateContextWindow: 128_000,
			}),
		).toBe(true);
	});

	it("keeps a candidate whose window is large enough", () => {
		expect(
			shouldSkipAutoTitleCandidateForContext({
				forceCurrentContextCheck: true,
				currentContextTokens: 100_000,
				candidateContextWindow: 128_000,
			}),
		).toBe(false);
	});
});

describe("pickAutoTitleModel", () => {
	it("prefers the earliest candidate in the built-in preference order", () => {
		expect(
			pickAutoTitleModel({
				availableModels: [
					{ provider: "github-copilot", id: "gpt-5.4-mini", contextWindow: 400_000 },
					{ provider: "opencode", id: "big-pickle", contextWindow: 200_000 },
				],
				forceCurrentContextCheck: false,
				currentContextTokens: null,
			}),
		).toEqual({ provider: "github-copilot", id: "gpt-5.4-mini", contextWindow: 400_000 });
	});

	it("picks a model whose window fits the forced context", () => {
		expect(
			pickAutoTitleModel({
				availableModels: [
					{ provider: "deepseek", id: "deepseek-v4-flash", contextWindow: 1_000_000 },
					{ provider: "github-copilot", id: "gpt-5.4-mini", contextWindow: 400_000 },
				],
				forceCurrentContextCheck: true,
				currentContextTokens: 700_000,
			}),
		).toEqual({ provider: "deepseek", id: "deepseek-v4-flash", contextWindow: 1_000_000 });
	});

	it("returns undefined when every candidate is too small", () => {
		expect(
			pickAutoTitleModel({
				availableModels: [
					{ provider: "openai-codex", id: "gpt-5.4-mini", contextWindow: 400_000 },
					{ provider: "github-copilot", id: "gpt-5.4-mini", contextWindow: 400_000 },
					{ provider: "anthropic", id: "claude-haiku-4-5", contextWindow: 200_000 },
					{ provider: "opencode", id: "big-pickle", contextWindow: 200_000 },
				],
				forceCurrentContextCheck: true,
				currentContextTokens: 500_000,
			}),
		).toBeUndefined();
	});
});
