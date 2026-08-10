import { describe, expect, it } from "vitest";
import {
	filterSessionTitleMessagesFromContext,
	SESSION_TITLE_MESSAGE_TYPE,
} from "../src/extensions/session-naming/title-context.ts";
import { shouldCreateInitialTitlePending } from "../src/extensions/session-naming/title-scheduling.ts";
import {
	BUILTIN_TITLE_TAGS,
	fallbackDatetime,
	formatTitleTagCatalog,
	isTrivialInput,
	normalizeTitle,
	resolveTitleTags,
} from "../src/extensions/session-naming/title-utils.ts";

const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const builtinTagNames = BUILTIN_TITLE_TAGS.map((tag) => tag.name);

function tagged(raw: string, overrides: { maxLength?: number; scopeMaxLength?: number; tags?: string[] } = {}) {
	return normalizeTitle(raw, {
		maxLength: overrides.maxLength ?? 52,
		...(overrides.scopeMaxLength === undefined ? {} : { scopeMaxLength: overrides.scopeMaxLength }),
		useTags: true,
		tags: overrides.tags ?? builtinTagNames,
	});
}

describe("fallbackDatetime", () => {
	it("produces a local ISO-like stamp with an offset", () => {
		expect(fallbackDatetime()).toMatch(ISO_FALLBACK_RE);
	});
});

describe("BUILTIN_TITLE_TAGS", () => {
	it.each(["research", "fix", "onboard", "scaffold", "bootstrap", "init", "skill"])("describes the %s tag", (name) => {
		const tag = BUILTIN_TITLE_TAGS.find((candidate) => candidate.name === name);
		expect(tag?.description).toBeTruthy();
	});
});

describe("resolveTitleTags", () => {
	it("appends custom tags, lowercasing and dropping duplicates and invalid names", () => {
		expect(resolveTitleTags({ builtinTags: true, tags: ["cook", "Research", "bad tag"] })).toEqual([
			...BUILTIN_TITLE_TAGS,
			{ name: "cook" },
		]);
	});

	it("supports tuple and description forms without the builtins", () => {
		expect(
			resolveTitleTags({
				builtinTags: false,
				tags: [["Cook", "Use when cooking"], "meet", ["bad tag", "nope"], ["book", ""]],
			}),
		).toEqual([{ name: "cook", description: "Use when cooking" }, { name: "meet" }, { name: "book" }]);
	});
});

describe("formatTitleTagCatalog", () => {
	it("renders one bullet per tag, with the description when present", () => {
		expect(formatTitleTagCatalog([{ name: "cook", description: "Use when cooking" }, { name: "meet" }])).toBe(
			"- cook — Use when cooking\n- meet",
		);
	});
});

describe("isTrivialInput", () => {
	it.each(["hello", "hi!", "test", "ok", "?", "...", "thanks", "ty", "gm", ""])("treats %j as trivial", (input) => {
		expect(isTrivialInput(input)).toBe(true);
	});

	it.each(["fix auth bug in refresh token flow", "please refactor parser module", "propose teardown wireframes"])(
		"treats %j as substantive",
		(input) => {
			expect(isTrivialInput(input)).toBe(false);
		},
	);
});

describe("normalizeTitle", () => {
	it.each([
		"feat(auth): refresh token support",
		"propose(teardown): wireframe options",
		"research: agentic title taxonomies",
		"analyze(pi): session naming flow",
	])("passes through the well-formed title %j", (input) => {
		expect(tagged(input)).toBe(input);
	});

	it("strips surrounding quotes", () => {
		expect(tagged('"fix(parser): repair broken parser"')).toBe("fix(parser): repair broken parser");
	});

	it("strips a trailing period", () => {
		expect(tagged("feat(api): rate limiting.")).toBe("feat(api): rate limiting");
	});

	it("lowercases the tag and scope", () => {
		expect(tagged("Feat(Parser): repair broken parser")).toBe("feat(parser): repair broken parser");
	});

	it("keeps a scope within the configured scope length", () => {
		expect(tagged("research(recipe): chocolate", { maxLength: 10, scopeMaxLength: 12 })).toBe(
			"research(recipe): chocolate",
		);
	});

	it.each([
		["a scope longer than the default limit", "research(really-long-scope-name): short", { maxLength: 5 }],
		["a scope over an explicit limit", "research(longscopeword): short", { maxLength: 5, scopeMaxLength: 8 }],
		["a description over the limit", "research(recipe): chocolate cookie recipe", { maxLength: 10 }],
		["an untagged line", "just random text", {}],
		["an invalid dashed scope", "Feat(auth-service): uppercase type invalid scope", {}],
		["a compound scope", "feat(pi-fancy-editor): extract standalone extension package", {}],
	])("falls back to the datetime for %s", (_label, raw, overrides) => {
		expect(tagged(raw, overrides)).toMatch(ISO_FALLBACK_RE);
	});

	it("rejects a tag outside the configured set", () => {
		expect(tagged("fix(auth): refresh token flow", { tags: ["cook"] })).toMatch(ISO_FALLBACK_RE);
	});

	it("accepts a custom tag from the configured set", () => {
		expect(tagged("cook(recipe): chocolate cookies", { maxLength: 24, tags: ["cook"] })).toBe(
			"cook(recipe): chocolate cookies",
		);
	});

	it("accepts a plain title when tags are disabled", () => {
		expect(normalizeTitle("short title without tag", { maxLength: 24, useTags: false, tags: [] })).toBe(
			"short title without tag",
		);
	});

	it("accepts a plain title when no tags are configured", () => {
		expect(normalizeTitle("plain title with no tags configured", { maxLength: 40, useTags: true, tags: [] })).toBe(
			"plain title with no tags configured",
		);
	});

	it("falls back when an untagged title is too long", () => {
		expect(normalizeTitle("title body that is far too long", { maxLength: 8, useTags: false, tags: [] })).toMatch(
			ISO_FALLBACK_RE,
		);
	});

	it("strips ANSI escapes", () => {
		expect(tagged("[32mfix(todo): replace progress glyphs[0m")).toBe("fix(todo): replace progress glyphs");
	});

	it("recovers a title prefix from a line containing TUI border glyphs", () => {
		expect(tagged("fix(todo): replace progress glyphs╻▄▄▄▄▄▄")).toBe("fix(todo): replace progress glyphs");
	});
});

describe("filterSessionTitleMessagesFromContext", () => {
	it("drops our own title messages but keeps other custom messages", () => {
		const messages = [
			{ role: "user", content: "hello" },
			{ role: "custom", customType: SESSION_TITLE_MESSAGE_TYPE, content: "hidden" },
			{ role: "custom", customType: "other-extension", content: "kept" },
		];

		expect(filterSessionTitleMessagesFromContext(messages)).toEqual([messages[0], messages[2]]);
	});
});

describe("shouldCreateInitialTitlePending", () => {
	const base = {
		pending: false,
		generating: false,
		titleGenerationEnabled: true,
		hasTemporaryTitle: false,
		shouldSkip: false,
	};

	it("schedules a title on a fresh session", () => {
		expect(shouldCreateInitialTitlePending(base)).toBe(true);
	});

	it("does not schedule while a temporary title is awaiting retry", () => {
		expect(shouldCreateInitialTitlePending({ ...base, hasTemporaryTitle: true })).toBe(false);
	});

	it("does not schedule when the session already has a name", () => {
		expect(shouldCreateInitialTitlePending({ ...base, shouldSkip: true })).toBe(false);
	});

	it("does not schedule while disabled, pending, or generating", () => {
		expect(shouldCreateInitialTitlePending({ ...base, titleGenerationEnabled: false })).toBe(false);
		expect(shouldCreateInitialTitlePending({ ...base, pending: true })).toBe(false);
		expect(shouldCreateInitialTitlePending({ ...base, generating: true })).toBe(false);
	});
});
