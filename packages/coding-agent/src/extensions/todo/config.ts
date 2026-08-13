import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface GuidanceFields {
	promptSnippet?: string;
	promptGuidelines?: string[];
}

interface TodoConfig {
	guidance?: GuidanceFields;
	maxWidgetLines?: number;
	collapseKey?: string;
}

export const DEFAULT_MAX_WIDGET_LINES = 12;
export const DEFAULT_COLLAPSE_KEY = "ctrl+shift+t";
export const COLLAPSE_KEY_OFF = "off";

export function loadConfig(): TodoConfig {
	try {
		const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
		const parsed: unknown = JSON.parse(readFileSync(join(configHome, "rpiv-todo", "config.json"), "utf8"));
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as TodoConfig) : {};
	} catch {
		return {};
	}
}

export function validateGuidanceFields(value: unknown): GuidanceFields {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
	const fields = value as Record<string, unknown>;
	return {
		...(typeof fields.promptSnippet === "string" && fields.promptSnippet.trim()
			? { promptSnippet: fields.promptSnippet }
			: {}),
		...(Array.isArray(fields.promptGuidelines) && fields.promptGuidelines.every((item) => typeof item === "string")
			? { promptGuidelines: fields.promptGuidelines }
			: {}),
	};
}

export function getMaxWidgetLines(): number {
	const lines = loadConfig().maxWidgetLines;
	return typeof lines === "number" && lines >= 3 ? lines : DEFAULT_MAX_WIDGET_LINES;
}

const SPECIAL_KEYS = new Set([
	"escape",
	"esc",
	"enter",
	"return",
	"tab",
	"space",
	"backspace",
	"delete",
	"insert",
	"clear",
	"home",
	"end",
	"pageup",
	"pagedown",
	"up",
	"down",
	"left",
	"right",
	...Array.from({ length: 12 }, (_, index) => `f${index + 1}`),
]);
const MODIFIERS = new Set(["ctrl", "shift", "alt", "super"]);

export function isValidCollapseKeySpec(spec: string): boolean {
	if (!spec || spec.startsWith("+") || spec.endsWith("+") || spec.includes("++")) return false;
	const parts = spec.split("+");
	const base = parts.at(-1) ?? "";
	const modifiers = parts.slice(0, -1);
	if (modifiers.length !== new Set(modifiers).size || !modifiers.every((modifier) => MODIFIERS.has(modifier))) {
		return false;
	}
	return base.length === 1 ? /[a-z0-9_\-!@#$%^&*()|~`'":;,./<>?[\]{}=\\]/.test(base) : SPECIAL_KEYS.has(base);
}

export function resolveCollapseKey(): string {
	const raw = loadConfig().collapseKey?.trim().toLowerCase();
	if (!raw) return DEFAULT_COLLAPSE_KEY;
	if (raw === COLLAPSE_KEY_OFF) return COLLAPSE_KEY_OFF;
	return isValidCollapseKeySpec(raw) ? raw : DEFAULT_COLLAPSE_KEY;
}
