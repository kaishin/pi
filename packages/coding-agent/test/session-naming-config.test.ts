import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";
import {
	DEFAULT_SESSION_NAMING_CONFIG,
	type LoadedPiConfig,
	loadPiConfig,
	loadSessionNamingConfig,
} from "../src/extensions/session-naming/config.ts";

let agentDir: string;
let cwd: string;
let loaded: LoadedPiConfig;

beforeAll(async () => {
	const root = await mkdtemp(join(tmpdir(), "pi-session-naming-config-"));
	agentDir = join(root, "agent");
	cwd = join(root, "project");
	await mkdir(agentDir, { recursive: true });
	await mkdir(join(cwd, ".pi"), { recursive: true });

	await writeFile(
		join(agentDir, "settings.json"),
		JSON.stringify({
			session: {
				titleGeneration: {
					language: "Deutsch",
					model: "deepseek/deepseek-v4-flash:high",
					retries: 5,
					maxLength: 40,
					scopeMaxLength: 8,
					maxMessageCount: 7,
					includeTools: false,
					builtinTags: false,
					tags: [["cook", "Use when cooking"], "book"],
					style: { maxLength: 999, emojis: true },
					fallback: "datetime",
					commandStrategy: { waitTurns: 9 },
					retry: { maxTemporaryRetries: 9 },
				},
				list: { enabled: false, flag: "old-sessions", jsonFlag: "old-json" },
				rename: { command: "titel" },
			},
		}),
	);
	await writeFile(
		join(cwd, ".pi", "settings.json"),
		JSON.stringify({
			session: {
				title_generation: {
					emojis: true,
					max_message_count: 2,
					include_tools: true,
					use_tags: false,
					builtin_tags: true,
					tags: ["meet"],
				},
				browser: { pageSize: 5, showCwd: "always" },
			},
		}),
	);

	loaded = loadSessionNamingConfig(cwd, agentDir);
});

describe("DEFAULT_SESSION_NAMING_CONFIG", () => {
	it("pins the shipped title-generation defaults", () => {
		expect(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration).toEqual({
			enabled: true,
			language: "auto",
			model: "auto",
			retries: 3,
			emojis: false,
			maxLength: 52,
			scopeMaxLength: 12,
			maxMessageCount: -1,
			includeTools: true,
			useTags: true,
			builtinTags: true,
			tags: [],
		});
	});

	it.each(["style", "fallback", "commandStrategy", "retry"])("does not carry the removed %s key", (key) => {
		expect(Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration, key)).toBe(false);
	});

	it("does not carry the removed session.list section", () => {
		expect(Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session, "list")).toBe(false);
	});
});

describe("loadSessionNamingConfig", () => {
	it("merges global settings under project settings, accepting snake_case aliases", () => {
		expect(loaded.config.session.titleGeneration).toEqual({
			enabled: true,
			language: "Deutsch",
			model: "deepseek/deepseek-v4-flash:high",
			retries: 5,
			emojis: true,
			maxLength: 40,
			scopeMaxLength: 8,
			maxMessageCount: 2,
			includeTools: true,
			useTags: false,
			builtinTags: true,
			tags: ["meet"],
		});
	});

	it("applies overrides to the rename and browser sections", () => {
		expect(loaded.config.session.rename.command).toBe("titel");
		expect(loaded.config.session.browser.pageSize).toBe(5);
	});

	it("keeps defaults for keys the settings do not override", () => {
		expect(loaded.config.session.browser.command).toBe(DEFAULT_SESSION_NAMING_CONFIG.session.browser.command);
	});

	it("drops unknown keys rather than passing them through", () => {
		expect(Object.hasOwn(loaded.config.session, "list")).toBe(false);
		expect(Object.hasOwn(loaded.config.session.browser, "showCwd")).toBe(false);
	});

	it("reports the settings files it read", () => {
		expect(loaded.sources).toEqual([join(agentDir, "settings.json"), join(cwd, ".pi", "settings.json")]);
	});
});

describe("loadPiConfig", () => {
	it("resolves the agent directory from the environment", async () => {
		const previous = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
		try {
			const fromEnv = await loadPiConfig(cwd);
			expect(fromEnv.config.session.titleGeneration.language).toBe("Deutsch");
			expect(fromEnv.config.session.titleGeneration.maxLength).toBe(40);
		} finally {
			if (previous === undefined) delete process.env[ENV_AGENT_DIR];
			else process.env[ENV_AGENT_DIR] = previous;
		}
	});
});
