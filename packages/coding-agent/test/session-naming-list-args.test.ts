import { describe, expect, it } from "vitest";
import { parseListSessionsArgs } from "../src/extensions/session-naming/list.ts";

describe("parseListSessionsArgs", () => {
	it("enables listing with no filter", () => {
		expect(parseListSessionsArgs(["--list-sessions"])).toEqual({ enabled: true, json: false });
	});

	it("takes the following argument as a filter", () => {
		expect(parseListSessionsArgs(["--list-sessions", "auth"])).toEqual({
			enabled: true,
			filter: "auth",
			json: false,
		});
	});

	it("supports the --flag=value form alongside --json", () => {
		expect(parseListSessionsArgs(["--list-sessions=auth", "--json"])).toEqual({
			enabled: true,
			filter: "auth",
			json: true,
		});
	});

	it("parses --json on its own without enabling listing", () => {
		expect(parseListSessionsArgs(["--json"])).toEqual({ enabled: false, json: true });
	});

	it("does not mistake a following flag for a filter", () => {
		expect(parseListSessionsArgs(["--list-sessions", "--session-dir", "/tmp/sessions"])).toEqual({
			enabled: true,
			json: false,
			sessionDir: "/tmp/sessions",
		});
	});

	it("ignores an unrelated flag", () => {
		expect(parseListSessionsArgs(["--old-sessions", "auth"])).toEqual({ enabled: false, json: false });
	});
});
