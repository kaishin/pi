import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface ThemeLike {
	fg(color: string, text: string): string;
	bold(text: string): string;
	italic(text: string): string;
}

export type FooterActivity = "ready" | "working";

export interface FooterMetrics {
	usageAvailable: boolean;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cacheHitPercent?: number;
	contextWindow: number;
	contextPercent: number | null;
}

export interface FooterState {
	activity: FooterActivity;
	workingLabel?: string;
	modelId?: string;
	thinkingLevel?: string;
	branch?: string;
	dirty: boolean;
	metrics: FooterMetrics;
	extensionStatuses: readonly string[];
}

const WORKING_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const WORKING_ANIMATION_INTERVAL_MS = 120;
const CONTEXT_GAUGE_WIDTH = 8;

function formatTokens(count: number): string {
	const safe = Number.isFinite(count) ? Math.max(0, count) : 0;
	if (safe < 1_000) return safe.toString();
	if (safe < 10_000) return `${(safe / 1_000).toFixed(1)}k`;
	if (safe < 1_000_000) return `${Math.round(safe / 1_000)}k`;
	if (safe < 10_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
	return `${Math.round(safe / 1_000_000)}M`;
}

function palette(
	theme: ThemeLike,
	colorEnabled: boolean,
	role: "ready" | "working" | "input" | "output" | "cache" | "context" | "warning" | "error" | "muted",
	text: string,
): string {
	const rgb = {
		ready: [110, 168, 254],
		working: [255, 159, 67],
		input: [110, 168, 254],
		output: [177, 140, 255],
		cache: [125, 211, 252],
		context: [110, 168, 254],
		warning: [255, 159, 67],
		error: [255, 93, 115],
	} as const;
	if (colorEnabled && role !== "muted") {
		const [red, green, blue] = rgb[role];
		return `\u001b[38;2;${red};${green};${blue}m${text}\u001b[39m`;
	}
	const fallback =
		role === "error"
			? "error"
			: role === "cache" || role === "muted"
				? "muted"
				: role === "working" || role === "warning"
					? "accent"
					: "text";
	return theme.fg(fallback, text);
}

function sanitize(text: string): string {
	return text
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function selectResponsiveMode(width: number): "gallery" | "balanced" | "focus" | "telemetry" | "safe" {
	if (width >= 132) return "gallery";
	if (width >= 96) return "balanced";
	if (width >= 72) return "focus";
	if (width >= 56) return "telemetry";
	return "safe";
}

function activity(
	state: FooterState,
	full: boolean,
	theme: ThemeLike,
	colorEnabled: boolean,
	spinnerFrame: string,
): string {
	if (!full) return palette(theme, colorEnabled, state.activity, "●");
	if (state.activity === "working") {
		const label = `${(state.workingLabel ?? "WORKING").charAt(0)}${(state.workingLabel ?? "WORKING").slice(1).toLowerCase()}…`;
		return palette(theme, colorEnabled, "working", `${spinnerFrame} ${theme.italic(label)}`);
	}
	return palette(theme, colorEnabled, "ready", "● Ready");
}

function telemetry(metrics: FooterMetrics, theme: ThemeLike, colorEnabled: boolean): [string, string, string] {
	const unavailable = theme.fg("dim", "—");
	const usage = (amount: number) => (metrics.usageAvailable ? formatTokens(amount) : unavailable);
	const input = palette(theme, colorEnabled, "input", `↑ ${usage(metrics.input)}`);
	const output = palette(theme, colorEnabled, "output", `↓ ${usage(metrics.output)}`);
	const cacheHit =
		metrics.cacheHitPercent !== undefined && Number.isFinite(metrics.cacheHitPercent)
			? `${Math.round(metrics.cacheHitPercent)}%`
			: unavailable;
	const cache = palette(theme, colorEnabled, "cache", `↯ ${cacheHit}`);
	const contextPercentValue =
		typeof metrics.contextPercent === "number" && Number.isFinite(metrics.contextPercent)
			? metrics.contextPercent
			: undefined;
	const contextPercent = contextPercentValue === undefined ? "—" : `${Math.round(contextPercentValue)}%`;
	let gauge = "◔";
	if (contextPercentValue !== undefined) {
		const filled = Math.round((Math.max(0, Math.min(100, contextPercentValue)) / 100) * CONTEXT_GAUGE_WIDTH);
		gauge = `${"█".repeat(filled)}${"░".repeat(CONTEXT_GAUGE_WIDTH - filled)}`;
	}
	const context = `${gauge} ${contextPercent}/${formatTokens(metrics.contextWindow)}`;
	const contextRole =
		contextPercentValue === undefined
			? "muted"
			: contextPercentValue >= 90
				? "error"
				: contextPercentValue >= 70
					? "warning"
					: "context";
	return [`${input} ${output}`, cache, palette(theme, colorEnabled, contextRole, context)];
}

/** Render the fixed editorial pi-bar footer: activity, metrics, context, model, git, and extension statuses. */
export function renderFooterLine(
	state: FooterState,
	theme: ThemeLike,
	width: number,
	colorEnabled = true,
	spinnerFrame: string = WORKING_SPINNER_FRAMES[0],
): string {
	if (width <= 0) return "";
	const mode = selectResponsiveMode(width);
	const [io, cache, context] = telemetry(state.metrics, theme, colorEnabled);
	const workspace: string[] = [];
	if (mode !== "telemetry" && mode !== "safe") {
		workspace.push(activity(state, mode === "gallery" || mode === "balanced", theme, colorEnabled, spinnerFrame));
	}
	if (state.modelId && (mode === "gallery" || mode === "balanced" || mode === "focus")) {
		const budget = mode === "gallery" ? 30 : mode === "balanced" ? 22 : 16;
		const thinking = state.thinkingLevel
			? mode === "gallery"
				? ` · ${state.thinkingLevel}`
				: mode === "balanced"
					? ` · ${state.thinkingLevel.slice(0, 1)}`
					: ""
			: "";
		workspace.push(`${theme.fg("text", truncateToWidth(state.modelId, budget, ""))}${theme.fg("muted", thinking)}`);
	}
	if (state.branch && (mode === "gallery" || mode === "balanced")) {
		const branch = truncateToWidth(state.branch, mode === "gallery" ? 18 : 12, "");
		workspace.push(`${theme.fg("text", branch)}${state.dirty ? palette(theme, colorEnabled, "warning", " ✦") : ""}`);
	}

	if (mode === "gallery") {
		const status = state.extensionStatuses.map(sanitize).filter(Boolean).join(" ");
		const leftGroups = status && visibleWidth(status) <= 24 ? [...workspace, theme.fg("muted", status)] : workspace;
		const left = leftGroups.length > 0 ? `  ${leftGroups.join("  ")}` : "";
		const right = [io, cache, context].join("  ");
		const padding = width - visibleWidth(left) - visibleWidth(right);
		if (padding >= 2) return `${left}${" ".repeat(padding)}${right}`;
	}

	const required = [io, cache, context];
	if (mode === "balanced" || mode === "focus") {
		const separator = mode === "balanced" ? theme.fg("borderMuted", " │ ") : theme.fg("borderMuted", " · ");
		const remainingWorkspace = [...workspace];
		while (
			remainingWorkspace.length > 0 &&
			visibleWidth([`  ${remainingWorkspace.join(separator)}`, ...required].join(separator)) > width
		) {
			remainingWorkspace.pop();
		}
		return truncateToWidth(
			[remainingWorkspace.length > 0 ? `  ${remainingWorkspace.join(separator)}` : "", ...required]
				.filter(Boolean)
				.join(separator),
			width,
			"",
		);
	}
	return truncateToWidth(required.join(" "), width, "");
}

export function createFooterComponent(options: {
	getState(): FooterState;
	theme: ThemeLike;
	colorEnabled: boolean;
	requestRender(): void;
	onBranchChange(callback: () => void): () => void;
}): Component & { dispose(): void } {
	let disposed = false;
	let frameIndex = 0;
	let animationTimer: ReturnType<typeof setInterval> | undefined;
	const unsubscribe = options.onBranchChange(options.requestRender);

	return {
		render(width) {
			const state = options.getState();
			const spinnerFrame = WORKING_SPINNER_FRAMES[frameIndex] ?? WORKING_SPINNER_FRAMES[0];
			const line = renderFooterLine(state, options.theme, width, options.colorEnabled, spinnerFrame);
			const fullActivity = activity(state, true, options.theme, options.colorEnabled, spinnerFrame);
			const animate = state.activity === "working" && line.includes(fullActivity);
			if (!disposed && animate && !animationTimer) {
				animationTimer = setInterval(() => {
					frameIndex = (frameIndex + 1) % WORKING_SPINNER_FRAMES.length;
					options.requestRender();
				}, WORKING_ANIMATION_INTERVAL_MS);
			} else if ((!animate || disposed) && animationTimer) {
				clearInterval(animationTimer);
				animationTimer = undefined;
				frameIndex = 0;
			}
			return [line];
		},
		invalidate() {},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (animationTimer) clearInterval(animationTimer);
			unsubscribe();
		},
	};
}

export const barFooterTestUtils = { formatTokens, selectResponsiveMode };
