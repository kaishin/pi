export interface UsageSnapshot {
	totalTokens?: number;
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
}

export function tokenDeltaFromUsage(usage: UsageSnapshot | null | undefined): number {
	if (!usage) return 0;
	if (typeof usage.totalTokens === "number") return Math.max(0, usage.totalTokens);
	return Math.max(
		0,
		(Number(usage.input) || 0) +
			(Number(usage.output) || 0) +
			(Number(usage.cacheRead) || 0) +
			(Number(usage.cacheWrite) || 0),
	);
}
