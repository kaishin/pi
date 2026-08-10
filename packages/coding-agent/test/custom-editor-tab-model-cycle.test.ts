import { setKeybindings, TuiMainScreen } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEditorTheme } from "../../tui/test/test-themes.ts";
import { VirtualTerminal } from "../../tui/test/virtual-terminal.ts";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { CustomEditor } from "../src/modes/interactive/components/custom-editor.ts";

const TAB = "\t";

afterEach(() => {
	setKeybindings(new KeybindingsManager());
});

function createEditor(keybindings: KeybindingsManager): { editor: CustomEditor; cycles: () => number } {
	setKeybindings(keybindings);
	const editor = new CustomEditor(new TuiMainScreen(new VirtualTerminal()), defaultEditorTheme, keybindings);
	let cycles = 0;
	editor.onAction("app.model.cycleOnEmpty", () => {
		cycles++;
	});
	return { editor, cycles: () => cycles };
}

describe("CustomEditor tab model cycling", () => {
	it("cycles the model when tab is pressed on an empty editor", () => {
		const { editor, cycles } = createEditor(new KeybindingsManager());

		editor.handleInput(TAB);

		expect(cycles()).toBe(1);
		expect(editor.getText()).toBe("");
	});

	it("treats a whitespace-only editor as empty", () => {
		const { editor, cycles } = createEditor(new KeybindingsManager());
		editor.setText("   ");

		editor.handleInput(TAB);

		expect(cycles()).toBe(1);
	});

	it("leaves tab to completion once anything is typed", () => {
		const { editor, cycles } = createEditor(new KeybindingsManager());

		editor.setText("src/co");
		editor.handleInput(TAB);
		expect(cycles()).toBe(0);
		expect(editor.getText()).toBe("src/co");

		editor.setText("/pl");
		editor.handleInput(TAB);
		expect(cycles()).toBe(0);
		expect(editor.getText()).toBe("/pl");
	});

	it("honours a user rebinding of the empty-editor action", () => {
		const { editor, cycles } = createEditor(new KeybindingsManager({ "app.model.cycleOnEmpty": "ctrl+g" }));

		editor.handleInput(TAB);
		expect(cycles()).toBe(0);

		editor.handleInput("\x07"); // Ctrl+G
		expect(cycles()).toBe(1);
	});

	it("does not cycle when the action is unbound", () => {
		const { editor, cycles } = createEditor(new KeybindingsManager({ "app.model.cycleOnEmpty": [] }));

		editor.handleInput(TAB);

		expect(cycles()).toBe(0);
	});
});
