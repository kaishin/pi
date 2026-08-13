import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI, ToolDefinition } from "../src/core/extensions/types.ts";
import minimaxExtension, { getMiniMaxApiBase, MODELS } from "../src/extensions/minimax/index.ts";

describe("minimax extension", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("registers the global provider and every Token Plan tool without CN support", () => {
		const providers: Array<{ name: string; config: { baseUrl: string; apiKey: string; models: unknown[] } }> = [];
		const tools: string[] = [];
		minimaxExtension({
			registerProvider: (name: string, config: { baseUrl: string; apiKey: string; models: unknown[] }) =>
				providers.push({ name, config }),
			registerTool: (tool: { name: string }) => tools.push(tool.name),
		} as unknown as ExtensionAPI);

		expect(providers).toEqual([
			expect.objectContaining({
				name: "minimax",
				config: expect.objectContaining({
					baseUrl: "https://api.minimax.io/anthropic",
					apiKey: "$MINIMAX_API_KEY",
				}),
			}),
		]);
		expect(tools).toEqual([
			"minimax_web_search",
			"minimax_understand_image",
			"minimax_list_voices",
			"minimax_text_to_audio",
			"minimax_generate_image",
			"minimax_video",
			"minimax_generate_music",
			"minimax_quota",
		]);
	});

	it("retains the expanded global catalog and M3 adaptive thinking", () => {
		expect(MODELS).toHaveLength(8);
		expect(MODELS.map((model) => model.id)).not.toContain("minimax-cn");
		expect(getMiniMaxApiBase()).toBe("https://api.minimax.io/anthropic");
	});

	it("omits emotion unless the caller supplies it", async () => {
		const tools = new Map<string, ToolDefinition>();
		minimaxExtension({
			registerProvider() {},
			registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool),
		} as unknown as ExtensionAPI);
		const fetchMock = vi.fn(async () => Response.json({ data: { audio_url: "https://example.com/audio.mp3" } }));
		vi.stubGlobal("fetch", fetchMock);

		const textToAudio = tools.get("minimax_text_to_audio");
		if (!textToAudio) throw new Error("MiniMax text-to-audio tool was not registered.");
		await textToAudio.execute(
			"call-1",
			{ model: "speech-2.5-hd-flash", output_mode: "url", text: "Hello" },
			undefined,
			undefined,
			{ modelRegistry: { getApiKeyForProvider: async () => "test-key" } } as unknown as Parameters<
				typeof textToAudio.execute
			>[4],
		);

		const request = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
			voice_setting: Record<string, unknown>;
		};
		expect(request.voice_setting).not.toHaveProperty("emotion");
	});
});
