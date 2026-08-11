import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "../src/core/extensions/types.ts";
import {
	barFooterTestUtils,
	type FooterState,
	renderFooterLine,
	type ThemeLike,
} from "../src/extensions/bar-footer/footer.ts";
import barFooterExtension from "../src/extensions/bar-footer/index.ts";

const theme: ThemeLike = {
	fg: (_color, text) => text,
	bold: (text) => text,
	italic: (text) => text,
};

function createState(): FooterState {
	return {
		activity: "ready",
		modelId: "MiniMax-M3",
		thinkingLevel: "high",
		branch: "main",
		dirty: true,
		metrics: {
			usageAvailable: true,
			input: 12_345,
			output: 678,
			cacheRead: 4_000,
			cacheWrite: 0,
			cacheHitPercent: 24.7,
			contextWindow: 200_000,
			contextPercent: 76,
		},
		extensionStatuses: ["Goal active"],
	};
}

describe("bar footer", () => {
	it("registers only the footer lifecycle handlers", () => {
		const events: string[] = [];
		barFooterExtension({ on: (event: string) => events.push(event) } as unknown as ExtensionAPI);

		expect(events).toEqual([
			"session_start",
			"before_agent_start",
			"agent_start",
			"agent_settled",
			"turn_end",
			"model_select",
			"thinking_level_select",
			"session_compact",
			"session_info_changed",
			"session_shutdown",
		]);
	});

	it("renders the configured activity, metrics, context, model, git, and status segments", () => {
		const line = renderFooterLine(createState(), theme, 160, false);

		expect(line).toContain("● Ready");
		expect(line).toContain("↑ 12k");
		expect(line).toContain("↓ 678");
		expect(line).toContain("↯ 25%");
		expect(line).toContain("██████░░ 76%/200k");
		expect(line).toContain("MiniMax-M3 · high");
		expect(line).toContain("main ✦");
		expect(line).toContain("Goal active");
		expect(line).not.toContain("BAR");
		expect(line).not.toContain("⌥A");
	});

	it("uses the configured responsive breakpoints", () => {
		expect(barFooterTestUtils.selectResponsiveMode(132)).toBe("gallery");
		expect(barFooterTestUtils.selectResponsiveMode(96)).toBe("balanced");
		expect(barFooterTestUtils.selectResponsiveMode(72)).toBe("focus");
		expect(barFooterTestUtils.selectResponsiveMode(56)).toBe("telemetry");
		expect(barFooterTestUtils.selectResponsiveMode(55)).toBe("safe");
	});

	it("uses the unknown-context indicator before the next model response", () => {
		const state = createState();
		state.metrics.contextPercent = null;

		expect(renderFooterLine(state, theme, 80, false)).toContain("◔ —/200k");
	});

	it("keeps the footer within every terminal width", () => {
		for (let width = 1; width <= 200; width++) {
			expect(visibleWidth(renderFooterLine(createState(), theme, width, false))).toBeLessThanOrEqual(width);
		}
	});
});
