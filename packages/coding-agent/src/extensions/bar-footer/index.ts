import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import { selectWorkingPhrase } from "./activity.ts";
import { createFooterComponent, type FooterMetrics, type FooterState } from "./footer.ts";

class BarFooterRuntime {
	private disposed = false;
	private pi: ExtensionAPI;
	private ctx: ExtensionContext;
	private requestRender: () => void;
	private state: FooterState = {
		activity: "ready",
		dirty: false,
		metrics: {
			usageAvailable: false,
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			contextWindow: 0,
			contextPercent: null,
		},
		extensionStatuses: [],
	};

	constructor(pi: ExtensionAPI, ctx: ExtensionContext, requestRender: () => void) {
		this.pi = pi;
		this.ctx = ctx;
		this.requestRender = requestRender;
	}

	getState(): FooterState {
		return this.state;
	}

	setActivity(activity: FooterState["activity"]): void {
		if (this.state.activity === activity) return;
		this.state = {
			...this.state,
			activity,
			...(activity === "working" ? { workingLabel: selectWorkingPhrase(Math.random()) } : {}),
		};
		this.requestRender();
	}

	refresh(): void {
		if (this.disposed) return;
		let input = 0;
		let output = 0;
		let cacheRead = 0;
		let cacheWrite = 0;
		let cacheHitPercent: number | undefined;
		let usageAvailable = false;

		for (const entry of this.ctx.sessionManager.getEntries()) {
			if (entry.type !== "message" || entry.message.role !== "assistant") continue;
			const usage = entry.message.usage;
			if (!usage || ![usage.input, usage.output, usage.cacheRead, usage.cacheWrite].every(Number.isFinite)) continue;
			usageAvailable = true;
			input += usage.input;
			output += usage.output;
			cacheRead += usage.cacheRead;
			cacheWrite += usage.cacheWrite;
			const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
			cacheHitPercent = promptTokens > 0 ? (usage.cacheRead / promptTokens) * 100 : undefined;
		}

		const context = this.ctx.getContextUsage();
		const metrics: FooterMetrics = {
			usageAvailable,
			input,
			output,
			cacheRead,
			cacheWrite,
			...(cacheHitPercent === undefined ? {} : { cacheHitPercent }),
			contextWindow: context?.contextWindow ?? 0,
			contextPercent: context?.percent ?? null,
		};
		const model = this.ctx.model;
		const { modelId: _modelId, thinkingLevel: _thinkingLevel, ...stateWithoutModel } = this.state;
		this.state = {
			...stateWithoutModel,
			...(model ? { modelId: model.id, thinkingLevel: this.pi.getThinkingLevel() } : {}),
			metrics,
		};
		this.requestRender();
	}

	async refreshGitDirty(): Promise<void> {
		if (this.disposed) return;
		let dirty = false;
		try {
			const result = await this.pi.exec("git", ["status", "--porcelain", "--untracked-files=no"], {
				timeout: 2_000,
			});
			dirty = result.code === 0 && result.stdout.trim().length > 0;
		} catch {
			// A footer should not surface git availability failures.
		}
		if (this.state.dirty === dirty) return;
		this.state = { ...this.state, dirty };
		this.requestRender();
	}

	dispose(): void {
		this.disposed = true;
	}
}

/**
 * The fixed footer formerly configured through pi-bar. It intentionally keeps
 * only the active footer segments and omits pi-bar's menu, commands, settings,
 * persisted configuration, and transcript entries.
 */
export default function barFooterExtension(pi: ExtensionAPI): void {
	let runtime: BarFooterRuntime | undefined;
	let requestRender: () => void = () => undefined;

	function installFooter(ctx: ExtensionContext): void {
		if (!runtime || ctx.mode !== "tui") return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			return createFooterComponent({
				getState: () => {
					const state = runtime?.getState();
					if (!state) throw new Error("Bar footer runtime unavailable");
					const branch = footerData.getGitBranch();
					return {
						...state,
						...(branch ? { branch } : {}),
						extensionStatuses: Array.from(footerData.getExtensionStatuses().values()),
					};
				},
				theme,
				colorEnabled: !("NO_COLOR" in process.env),
				requestRender,
				onBranchChange: (callback) =>
					footerData.onBranchChange(() => {
						void runtime?.refreshGitDirty();
						callback();
					}),
			});
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setWorkingVisible(false);
		runtime?.dispose();
		runtime = new BarFooterRuntime(pi, ctx, () => requestRender());
		runtime.refresh();
		await runtime.refreshGitDirty();
		installFooter(ctx);
	});
	pi.on("before_agent_start", () => runtime?.setActivity("working"));
	pi.on("agent_start", () => runtime?.setActivity("working"));
	pi.on("agent_settled", () => runtime?.setActivity("ready"));
	pi.on("turn_end", async () => {
		runtime?.refresh();
		await runtime?.refreshGitDirty();
	});
	pi.on("model_select", () => runtime?.refresh());
	pi.on("thinking_level_select", () => runtime?.refresh());
	pi.on("session_compact", () => runtime?.refresh());
	pi.on("session_info_changed", () => runtime?.refresh());
	pi.on("session_shutdown", (_event, ctx) => {
		runtime?.dispose();
		runtime = undefined;
		requestRender = () => undefined;
		ctx.ui.setFooter(undefined);
	});
}
