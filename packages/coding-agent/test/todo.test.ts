import { describe, expect, it, vi } from "vitest";
import { __resetState, replaceState, setActiveRenderSession } from "../src/extensions/todo/state/store.ts";
import { TodoOverlay } from "../src/extensions/todo/todo-overlay.ts";

const task = { id: 1, subject: "Finish the task", status: "completed" as const };

describe("todo overlay", () => {
	it("unregisters after hiding the final completed task on the next agent turn", () => {
		__resetState();
		setActiveRenderSession("session");
		replaceState("session", { tasks: [task], nextId: 2 });
		const setWidget = vi.fn();
		const overlay = new TodoOverlay();
		overlay.setUICtx({ setWidget } as never);
		overlay.update();

		const factory = setWidget.mock.calls[0]?.[1] as (
			tui: { requestRender(): void },
			theme: {
				fg(_color: string, text: string): string;
				strikethrough(text: string): string;
			},
		) => {
			render(width: number): string[];
		};
		const widget = factory({ requestRender() {} }, { fg: (_color, text) => text, strikethrough: (text) => text });
		widget.render(80);
		overlay.hideCompletedTasksFromPreviousTurn();

		expect(setWidget).toHaveBeenLastCalledWith("rpiv-todos", undefined);
		expect(overlay.isRegistered()).toBe(false);
		__resetState();
	});
});
