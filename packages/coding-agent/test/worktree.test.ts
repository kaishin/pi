import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI, ExtensionCommandContext } from "../src/core/extensions/types.ts";
import { buildAddArguments, defaultWorktreePath, parseWorktreePorcelain } from "../src/extensions/worktree/git.ts";
import worktreeExtension from "../src/extensions/worktree/index.ts";
import { createWorktreeSettingsRuntime, resolveWorktreeRoot } from "../src/extensions/worktree/settings.ts";
import { parseWorktreeStatusPorcelain } from "../src/extensions/worktree/status.ts";

const oid = "0123456789abcdef0123456789abcdef01234567";

describe("worktree extension", () => {
	it("registers only the worktree command and settings lifecycle handlers", () => {
		const commands: string[] = [];
		const events: string[] = [];
		worktreeExtension({
			registerCommand: (name: string) => commands.push(name),
			on: (event: string) => events.push(event),
		} as unknown as ExtensionAPI);

		expect(commands).toEqual(["worktree"]);
		expect(events).toEqual(["session_start", "session_shutdown"]);
	});

	it("uses standard selectors for the command menu", async () => {
		let command: ((args: string, ctx: ExtensionCommandContext) => Promise<void>) | undefined;
		worktreeExtension({
			registerCommand: (
				_name: string,
				options: { handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> },
			) => {
				command = options.handler;
			},
			on() {},
			exec: async (_command: string, args: string[]) => {
				if (args[0] === "worktree") {
					return {
						stdout: `worktree /repo\0HEAD ${oid}\0branch refs/heads/main\0\0`,
						stderr: "",
						code: 0,
						killed: false,
					};
				}
				return { stdout: "/repo\n", stderr: "", code: 0, killed: false };
			},
		} as unknown as ExtensionAPI);
		const selections: string[][] = [];
		const context = {
			hasUI: true,
			cwd: "/repo",
			signal: undefined,
			waitForIdle: async () => undefined,
			ui: {
				select: async (_title: string, options: string[]) => {
					selections.push(options);
					return undefined;
				},
				notify() {},
			},
		} as unknown as ExtensionCommandContext;
		await command?.("", context);

		expect(selections).toEqual([
			[
				"Worktree status",
				"Add worktree",
				"Switch worktree",
				"Remove worktree",
				"Prune stale metadata",
				"Configure worktree root",
			],
		]);
	});

	it("parses worktrees and creates argv-only add commands", () => {
		const records = parseWorktreePorcelain(
			[
				"worktree /repo",
				`HEAD ${oid}`,
				"branch refs/heads/main",
				"",
				"worktree /repo-feature",
				`HEAD ${oid}`,
				"branch refs/heads/feat/login",
				"locked CI owns this",
				"",
			].join("\0"),
		);

		expect(records).toHaveLength(2);
		expect(records[1]).toMatchObject({ branch: "feat/login", lockedReason: "CI owns this" });
		expect(defaultWorktreePath("/repo", "feat/login", "/trees")).toBe("/trees/repo/feat-login");
		expect(buildAddArguments({ path: "/trees/repo/feature", branch: "feature", startOid: oid })).toEqual([
			"worktree",
			"add",
			"-b",
			"feature",
			"/trees/repo/feature",
			oid,
		]);
	});

	it("validates roots and retains the last valid root after invalid settings", async () => {
		const directory = await mkdtemp(join(tmpdir(), "pi-worktree-settings-"));
		const path = join(directory, "pi-worktree.json");
		try {
			expect(resolveWorktreeRoot("~/trees", "/home/alice", "linux")).toBe("/home/alice/trees");
			expect(() => resolveWorktreeRoot("$ROOT/trees", "/home/alice", "linux")).toThrow(/shell variable/i);
			await writeFile(path, '{"worktreeRoot":"/srv/trees"}\n');
			const runtime = createWorktreeSettingsRuntime({ path, home: "/home/alice", platform: "linux" });
			await runtime.reload();
			await writeFile(path, "{broken\n");
			await runtime.reload();

			expect(runtime.get()).toMatchObject({ effectiveRoot: "/srv/trees", canSave: false });
			await expect(runtime.save("/other")).rejects.toThrow(/fix.*settings file/i);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("parses local status without inventing upstream divergence", () => {
		const status = parseWorktreeStatusPorcelain(
			[
				`# branch.oid ${oid}`,
				"# branch.head feature",
				"# branch.upstream origin/feature",
				"1 M. N... 100644 100644 100644 aaaaaaa bbbbbbb staged.txt",
				"? untracked.txt",
				"",
			].join("\0"),
		);

		expect(status).toMatchObject({ branch: "feature", staged: 1, untracked: 1 });
		expect(status.ahead).toBeUndefined();
		expect(status.behind).toBeUndefined();
	});
});
