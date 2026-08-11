export type GoalStatus = "active" | "paused" | "budget_limited" | "complete";

export interface GoalState {
	version: 1;
	id: string;
	objective: string;
	status: GoalStatus;
	tokenBudget: number | null;
	tokensUsed: number;
	timeUsedSeconds: number;
	createdAt: number;
	updatedAt: number;
}

export type GoalEventKind =
	| "active"
	| "continuation"
	| "paused"
	| "resumed"
	| "cleared"
	| "budget_limited"
	| "complete";

export function parseTokenBudget(input: string): { objective: string; tokenBudget: number | null; error?: string } {
	const match = input.match(/(?:^|\s)--tokens(?:=|\s+)(\S+\s*[kKmM]?)(?:\s|$)/);
	if (!match) return { objective: input.trim(), tokenBudget: null };

	const raw = match[1].replace(/\s+/g, "");
	const suffix = raw.slice(-1).toLowerCase();
	const numeric = suffix === "k" || suffix === "m" ? raw.slice(0, -1) : raw;
	const value = Number(numeric);
	if (!Number.isFinite(value) || value <= 0) {
		return { objective: input.trim(), tokenBudget: null, error: "Token budget must be positive." };
	}
	const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
	const objective = `${input.slice(0, match.index)} ${input.slice((match.index ?? 0) + match[0].length)}`.trim();
	return { objective, tokenBudget: Math.round(value * multiplier) };
}

export function normalizeTokenBudget(value: unknown): { tokenBudget: number | null; error?: string } {
	if (value == null) return { tokenBudget: null };
	const tokenBudget = Math.round(Number(value));
	return Number.isFinite(tokenBudget) && tokenBudget > 0
		? { tokenBudget }
		: { tokenBudget: null, error: "tokenBudget must be a positive number when provided." };
}

export function formatTokens(value: number): string {
	if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
	if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
	return String(value);
}

export function formatElapsed(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function statusLine(state: GoalState | null): string | undefined {
	if (!state) return undefined;
	const budget = state.tokenBudget
		? ` (${formatTokens(state.tokensUsed)} / ${formatTokens(state.tokenBudget)})`
		: ` (${formatElapsed(state.timeUsedSeconds)})`;
	if (state.status === "active") return `Pursuing goal${budget}`;
	if (state.status === "paused") return "Goal paused (/goal resume)";
	if (state.status === "budget_limited") return state.tokenBudget ? `Goal unmet${budget}` : "Goal abandoned";
	return `Goal achieved${budget}`;
}

export function goalUsage(state: GoalState): string {
	return state.tokenBudget != null
		? `${formatTokens(state.tokensUsed)} / ${formatTokens(state.tokenBudget)} tokens`
		: formatElapsed(state.timeUsedSeconds);
}

export function truncateObjective(objective: string, max = 96): string {
	const singleLine = objective.replace(/\s+/g, " ").trim();
	return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine;
}

export function goalEventStatus(kind: GoalEventKind): string {
	return {
		active: "active",
		continuation: "continuing",
		paused: "paused",
		resumed: "resumed",
		cleared: "cleared",
		budget_limited: "budget reached",
		complete: "achieved",
	}[kind];
}

export function createGoalState(
	objective: string,
	tokenBudget: number | null,
	now = Date.now(),
	random = Math.random(),
): GoalState {
	return {
		version: 1,
		id: `${now}-${random.toString(16).slice(2)}`,
		objective,
		status: "active",
		tokenBudget,
		tokensUsed: 0,
		timeUsedSeconds: 0,
		createdAt: now,
		updatedAt: now,
	};
}

export function accountGoalTurn(
	state: GoalState,
	tokenDelta: number,
	elapsedSeconds: number,
	now = Date.now(),
): GoalState {
	const next = {
		...state,
		tokensUsed: state.tokensUsed + Math.max(0, tokenDelta),
		timeUsedSeconds: state.timeUsedSeconds + Math.max(0, elapsedSeconds),
		updatedAt: now,
	};
	return next.status === "active" && next.tokenBudget != null && next.tokensUsed >= next.tokenBudget
		? { ...next, status: "budget_limited" }
		: next;
}
