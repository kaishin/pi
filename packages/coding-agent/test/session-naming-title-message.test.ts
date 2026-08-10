import { describe, expect, it } from "vitest";
import { emitSessionTitleMessage, SESSION_TITLE_MESSAGE_TYPE } from "../src/extensions/session-naming/title-message.ts";

function recorder() {
	const sent: Array<{ message: unknown; options: unknown }> = [];
	const pi = {
		sendMessage(message: unknown, options?: unknown) {
			sent.push({ message, options });
		},
	};
	return { sent, pi };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("emitSessionTitleMessage", () => {
	it("waits for the agent to go idle before sending", async () => {
		const { sent, pi } = recorder();
		let idle = false;

		emitSessionTitleMessage(
			pi as never,
			{ title: "feat(session): auto title", actor: "github-copilot/gpt-5.4-mini", source: "auto" },
			{ ctx: { isIdle: () => idle }, pollMs: 5, maxWaitMs: 200 },
		);

		expect(sent).toHaveLength(0);

		idle = true;
		await delay(20);

		expect(sent).toHaveLength(1);
		expect(sent[0].options).toBeUndefined();
		expect((sent[0].message as { customType: string }).customType).toBe(SESSION_TITLE_MESSAGE_TYPE);
	});

	it("defers to the next turn once the idle wait times out", async () => {
		const { sent, pi } = recorder();

		emitSessionTitleMessage(
			pi as never,
			{ title: "feat(session): delayed title", actor: "github-copilot/gpt-5.4-mini", source: "auto" },
			{ ctx: { isIdle: () => false }, pollMs: 5, maxWaitMs: 10 },
		);

		await delay(30);

		expect(sent).toHaveLength(1);
		expect(sent[0].options).toEqual({ deliverAs: "nextTurn" });
	});

	it("sends immediately when no context is supplied", () => {
		const { sent, pi } = recorder();

		emitSessionTitleMessage(pi as never, {
			title: "feat(session): immediate title",
			actor: "/rename",
			source: "manual",
		});

		expect(sent).toHaveLength(1);
		expect(sent[0].options).toBeUndefined();
	});
});
