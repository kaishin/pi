import { describe, expect, it } from "vitest";
import {
	accountGoalTurn,
	createGoalState,
	formatElapsed,
	parseTokenBudget,
	statusLine,
} from "../src/extensions/goal/goal-state.ts";
import { tokenDeltaFromUsage } from "../src/extensions/goal/usage.ts";

describe("goal state", () => {
	it("parses a token budget without including the flag in the objective", () => {
		expect(parseTokenBudget("ship it --tokens 50k with tests")).toEqual({
			objective: "ship it with tests",
			tokenBudget: 50_000,
		});
	});

	it("rejects non-positive token budgets", () => {
		expect(parseTokenBudget("ship it --tokens 0").error).toBe("Token budget must be positive.");
	});

	it("accounts usage and stops at the token budget", () => {
		const state = createGoalState("ship it", 100, 1, 0.5);
		expect(accountGoalTurn(state, 125, 3, 2)).toMatchObject({
			status: "budget_limited",
			tokensUsed: 125,
			timeUsedSeconds: 3,
			updatedAt: 2,
		});
	});

	it("formats elapsed time and active status", () => {
		const state = { ...createGoalState("ship it", null, 1, 0.5), timeUsedSeconds: 90 };
		expect(formatElapsed(3_660)).toBe("1h 1m");
		expect(statusLine(state)).toBe("Pursuing goal (1m)");
	});

	it("uses total tokens when it is available", () => {
		expect(tokenDeltaFromUsage({ totalTokens: 42, input: 2, output: 3 })).toBe(42);
		expect(tokenDeltaFromUsage({ input: 2, output: 3, cacheRead: 4, cacheWrite: 5 })).toBe(14);
	});
});
