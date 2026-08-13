import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";

const MINIMAX_API_HOST = "https://api.minimax.io";
const MINIMAX_API_SOURCE = "Pi-MiniMax-Provider";
const AUDIO_FORMAT_VALUES = ["mp3", "pcm", "flac", "wav"] as const;
const OUTPUT_MODE_VALUES = ["local", "url"] as const;

type AudioFormat = (typeof AUDIO_FORMAT_VALUES)[number];
type OutputMode = (typeof OUTPUT_MODE_VALUES)[number];

export const MODELS = [
	{
		id: "MiniMax-M3",
		name: "MiniMax M3",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
		contextWindow: 1_000_000,
		maxTokens: 524_288,
	},
	{
		id: "MiniMax-M2.7",
		name: "MiniMax M2.7",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2.7-highspeed",
		name: "MiniMax M2.7 (Highspeed)",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.6, output: 2.4, cacheRead: 0.06, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2.5",
		name: "MiniMax M2.5",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2.5-highspeed",
		name: "MiniMax M2.5 (Highspeed)",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.6, output: 2.4, cacheRead: 0.03, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2.1",
		name: "MiniMax M2.1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2.1-highspeed",
		name: "MiniMax M2.1 (Highspeed)",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.6, output: 2.4, cacheRead: 0.03, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
	{
		id: "MiniMax-M2",
		name: "MiniMax M2",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.375 },
		contextWindow: 204_800,
		maxTokens: 65_536,
	},
] as const;

export function getMiniMaxApiHost(): string {
	return (process.env.MINIMAX_API_HOST || MINIMAX_API_HOST).replace(/\/$/u, "");
}

export function getMiniMaxApiBase(): string {
	return `${getMiniMaxApiHost()}/anthropic`;
}

async function getApiKey(ctx: ExtensionContext): Promise<string> {
	const key = await ctx.modelRegistry.getApiKeyForProvider("minimax");
	if (!key) throw new Error("MiniMax API key is required. Use /login for minimax or set MINIMAX_API_KEY.");
	return key;
}

async function requestJson<T>(
	ctx: ExtensionContext,
	path: string,
	options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
	const signal = options.signal
		? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 300_000)])
		: AbortSignal.timeout(options.timeoutMs ?? 300_000);
	const response = await fetch(`${getMiniMaxApiHost()}${path}`, {
		method: options.method ?? "GET",
		headers: {
			Authorization: `Bearer ${await getApiKey(ctx)}`,
			"Content-Type": "application/json",
			"MM-API-Source": MINIMAX_API_SOURCE,
		},
		...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
		signal,
	});
	const text = await response.text();
	let data: unknown;
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		throw new Error(`MiniMax API returned malformed JSON: ${text}`);
	}
	const baseResponse =
		data !== null && typeof data === "object"
			? (data as { base_resp?: { status_code?: number; status_msg?: string } }).base_resp
			: undefined;
	if (!response.ok || (baseResponse?.status_code !== undefined && baseResponse.status_code !== 0)) {
		throw new Error(
			`MiniMax API error: ${baseResponse?.status_code ?? response.status} ${baseResponse?.status_msg ?? text}`.trim(),
		);
	}
	return data as T;
}

function required(value: string | undefined, name: string): string {
	if (!value?.trim()) throw new Error(`${name} is required.`);
	return value;
}

function objectField(value: unknown, key: string): unknown {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

async function imageSourceToDataUrl(source: string, cwd: string, signal?: AbortSignal): Promise<string> {
	const value = required(source, "Image source").replace(/^@/u, "");
	if (value.startsWith("data:")) return value;
	if (value.startsWith("http://") || value.startsWith("https://")) {
		const response = await fetch(value, { signal });
		if (!response.ok) throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
		const buffer = Buffer.from(await response.arrayBuffer());
		if (buffer.byteLength > 50 * 1024 * 1024) throw new Error("Image exceeds the 50 MB limit.");
		return `data:${imageMimeType(value, response.headers.get("content-type"))};base64,${buffer.toString("base64")}`;
	}
	const path = resolve(cwd, value);
	return `data:${imageMimeType(path)};base64,${(await readFile(path)).toString("base64")}`;
}

function imageMimeType(path: string, contentType?: string | null): string {
	const type = contentType?.split(";", 1)[0]?.toLowerCase();
	if (type === "image/png" || type === "image/jpeg" || type === "image/webp") return type;
	const extension = extname(path).toLowerCase();
	if (extension === ".png") return "image/png";
	if (extension === ".webp") return "image/webp";
	return "image/jpeg";
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function audioFileName(text: string, format: AudioFormat): string {
	const stamp = new Date()
		.toISOString()
		.replace(/[-:]/gu, "")
		.replace(/\.\d{3}Z$/u, "")
		.replace("T", "-");
	return `minimax-audio-${stamp}-${createHash("sha1").update(text).digest("hex").slice(0, 6)}.${format}`;
}

async function writeAudio(
	hexAudio: string,
	options: { outputPath?: string; cwd: string; format: AudioFormat; text: string; allowOverwrite?: boolean },
): Promise<string> {
	if (!/^[0-9a-fA-F]+$/u.test(hexAudio) || hexAudio.length % 2 !== 0)
		throw new Error("MiniMax returned invalid audio data.");
	const requested = options.outputPath
		? resolve(options.cwd, options.outputPath)
		: resolve(options.cwd, audioFileName(options.text, options.format));
	const outputPath =
		(await pathExists(requested)) && (await stat(requested)).isDirectory()
			? resolve(requested, audioFileName(options.text, options.format))
			: extname(requested)
				? requested
				: resolve(requested, audioFileName(options.text, options.format));
	if (!options.allowOverwrite && (await pathExists(outputPath)))
		throw new Error(`Refusing to overwrite existing audio file: ${outputPath}`);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, Buffer.from(hexAudio, "hex"));
	return outputPath;
}

async function waitForVideo(ctx: ExtensionContext, taskId: string, signal?: AbortSignal): Promise<unknown> {
	const deadline = Date.now() + 300_000;
	while (Date.now() < deadline) {
		const data = await requestJson<unknown>(ctx, `/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
			signal,
			timeoutMs: 60_000,
		});
		const status = objectField(data, "status");
		if (status === "Success") return data;
		if (status === "Failed") throw new Error("MiniMax video generation failed.");
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
	}
	throw new Error("MiniMax video generation timed out.");
}

const AudioFormatSchema = Type.Union(AUDIO_FORMAT_VALUES.map((value) => Type.Literal(value)));
const OutputModeSchema = Type.Union(OUTPUT_MODE_VALUES.map((value) => Type.Literal(value)));

/**
 * International MiniMax provider and Token Plan tools. This is based on the
 * community provider but intentionally contains no CN endpoint, credentials,
 * region selection, or SDK/OAuth fallback.
 */
export default function minimaxExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "minimax_web_search",
		label: "MiniMax Web Search",
		description: "Search the web using MiniMax Token Plan.",
		parameters: Type.Object({ query: Type.String({ description: "Concise search query." }) }),
		async execute(_id, params, signal, _update, ctx) {
			const data = await requestJson<unknown>(ctx, "/v1/coding_plan/search", {
				method: "POST",
				body: { q: required(params.query, "Query") },
				signal,
			});
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data };
		},
	});

	pi.registerTool({
		name: "minimax_understand_image",
		label: "MiniMax Understand Image",
		description: "Analyze an image with MiniMax Token Plan.",
		parameters: Type.Object({
			prompt: Type.String({ description: "Question or analysis request." }),
			image_source: Type.String({ description: "Image URL, data URL, absolute path, or cwd-relative path." }),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const data = await requestJson<unknown>(ctx, "/v1/coding_plan/vlm", {
				method: "POST",
				body: {
					prompt: required(params.prompt, "Prompt"),
					image_url: await imageSourceToDataUrl(params.image_source, ctx.cwd, signal),
				},
				signal,
			});
			const content = objectField(data, "content");
			return {
				content: [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(data, null, 2) }],
				details: data,
			};
		},
	});

	pi.registerTool({
		name: "minimax_list_voices",
		label: "MiniMax List Voices",
		description: "List MiniMax Token Plan speech voices.",
		parameters: Type.Object({
			language: Type.Optional(Type.String({ description: "Optional language filter such as en or zh." })),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const data = await requestJson<unknown>(ctx, "/v1/get_voice", {
				method: "POST",
				body: { voice_type: "system" },
				signal,
			});
			const voices = objectField(data, "system_voice");
			const filtered = Array.isArray(voices)
				? voices.filter((voice) => {
						const id = objectField(voice, "voice_id");
						return (
							!params.language ||
							(typeof id === "string" && id.toLowerCase().startsWith(params.language.toLowerCase()))
						);
					})
				: [];
			const text = filtered.length
				? filtered
						.map(
							(voice) =>
								`- ${String(objectField(voice, "voice_name") ?? "Unnamed")}: ${String(objectField(voice, "voice_id") ?? "unknown")}`,
						)
						.join("\n")
				: "No voices returned.";
			return { content: [{ type: "text", text }], details: { voices: filtered } };
		},
	});

	pi.registerTool({
		name: "minimax_text_to_audio",
		label: "MiniMax Text to Audio",
		description: "Generate speech with MiniMax voices.",
		parameters: Type.Object({
			text: Type.String(),
			output_path: Type.Optional(Type.String()),
			voice_id: Type.Optional(Type.String()),
			model: Type.Optional(Type.String()),
			speed: Type.Optional(Type.Number({ minimum: 0.5, maximum: 2 })),
			volume: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
			pitch: Type.Optional(Type.Integer({ minimum: -12, maximum: 12 })),
			emotion: Type.Optional(Type.String()),
			sample_rate: Type.Optional(Type.Integer()),
			bitrate: Type.Optional(Type.Integer()),
			channel: Type.Optional(Type.Integer()),
			format: Type.Optional(AudioFormatSchema),
			language_boost: Type.Optional(Type.String()),
			output_mode: Type.Optional(OutputModeSchema),
			allow_overwrite: Type.Optional(Type.Boolean()),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const text = required(params.text, "Text");
			if (text.length > 10_000)
				throw new Error("Text exceeds the synchronous MiniMax text-to-speech limit of 10000 characters.");
			const format = params.format ?? "mp3";
			const outputMode: OutputMode = params.output_mode === "url" ? "url" : "local";
			const data = await requestJson<unknown>(ctx, "/v1/t2a_v2", {
				method: "POST",
				body: {
					model: params.model ?? "speech-2.8-hd",
					text,
					voice_setting: {
						voice_id: params.voice_id ?? "female-shaonv",
						speed: params.speed ?? 1,
						vol: params.volume ?? 1,
						pitch: params.pitch ?? 0,
						...(params.emotion === undefined ? {} : { emotion: params.emotion }),
					},
					audio_setting: {
						sample_rate: params.sample_rate ?? 32_000,
						bitrate: params.bitrate ?? 128_000,
						format,
						channel: params.channel ?? 1,
					},
					language_boost: params.language_boost ?? "auto",
					...(outputMode === "url" ? { output_format: "url" } : {}),
				},
				signal,
			});
			const audioData = objectField(data, "data");
			const audio = objectField(audioData, outputMode === "url" ? "audio_url" : "audio");
			if (typeof audio !== "string") throw new Error("No audio data returned from MiniMax.");
			if (outputMode === "url")
				return { content: [{ type: "text", text: `Success. Audio URL: ${audio}` }], details: data };
			const path = await writeAudio(audio, {
				outputPath: params.output_path,
				cwd: ctx.cwd,
				format,
				text,
				allowOverwrite: params.allow_overwrite,
			});
			return { content: [{ type: "text", text: `Success. Audio saved to: ${path}` }], details: { data, path } };
		},
	});

	pi.registerTool({
		name: "minimax_generate_image",
		label: "MiniMax Generate Image",
		description: "Generate images using MiniMax Token Plan.",
		parameters: Type.Object({
			prompt: Type.String(),
			model: Type.Optional(Type.String()),
			aspect_ratio: Type.Optional(Type.String()),
			n: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
			seed: Type.Optional(Type.Integer()),
			width: Type.Optional(Type.Integer()),
			height: Type.Optional(Type.Integer()),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const data = await requestJson<unknown>(ctx, "/v1/image_generation", {
				method: "POST",
				body: {
					model: params.model ?? "image-01",
					prompt: required(params.prompt, "Prompt"),
					aspect_ratio:
						params.width === undefined && params.height === undefined ? params.aspect_ratio : undefined,
					n: params.n ?? 1,
					seed: params.seed,
					width: params.width,
					height: params.height,
					response_format: "url",
				},
				signal,
			});
			const imageUrls = objectField(objectField(data, "data"), "image_urls");
			return {
				content: [
					{
						type: "text",
						text: Array.isArray(imageUrls)
							? imageUrls.filter((url): url is string => typeof url === "string").join("\n") ||
								JSON.stringify(data, null, 2)
							: JSON.stringify(data, null, 2),
					},
				],
				details: data,
			};
		},
	});

	pi.registerTool({
		name: "minimax_video",
		label: "MiniMax Video",
		description: "Generate, inspect, or download MiniMax videos.",
		parameters: Type.Object({
			action: Type.Union([Type.Literal("generate"), Type.Literal("status"), Type.Literal("download")]),
			prompt: Type.Optional(Type.String()),
			model: Type.Optional(Type.String()),
			task_id: Type.Optional(Type.String()),
			file_id: Type.Optional(Type.String()),
			output_path: Type.Optional(Type.String()),
			wait: Type.Optional(Type.Boolean()),
		}),
		async execute(_id, params, signal, _update, ctx) {
			if (params.action === "generate") {
				const data = await requestJson<unknown>(ctx, "/v1/video_generation", {
					method: "POST",
					body: { model: params.model ?? "MiniMax-Hailuo-2.3", prompt: required(params.prompt, "Prompt") },
					signal,
					timeoutMs: params.wait ? 300_000 : 60_000,
				});
				if (params.wait) {
					const taskId = objectField(data, "task_id");
					if (typeof taskId !== "string") throw new Error("MiniMax did not return a video task ID.");
					const result = await waitForVideo(ctx, taskId, signal);
					return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: result };
				}
				return {
					content: [{ type: "text", text: JSON.stringify({ taskId: objectField(data, "task_id") }, null, 2) }],
					details: data,
				};
			}
			if (params.action === "status") {
				const taskId = required(params.task_id, "Task ID");
				const data = await requestJson<unknown>(
					ctx,
					`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
					{ signal },
				);
				return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data };
			}
			const fileId = required(params.file_id, "File ID");
			const file = await requestJson<unknown>(ctx, `/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
				signal,
			});
			const downloadUrl = objectField(objectField(file, "file"), "download_url");
			if (typeof downloadUrl !== "string") throw new Error("No download URL available for this file.");
			const path = resolve(ctx.cwd, params.output_path || `minimax-video-${fileId}.mp4`);
			if (await pathExists(path)) throw new Error(`Refusing to overwrite existing video file: ${path}`);
			const response = await fetch(downloadUrl, { signal });
			if (!response.ok) throw new Error(`Video download failed: ${response.status} ${response.statusText}`);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, Buffer.from(await response.arrayBuffer()));
			return { content: [{ type: "text", text: `Video saved to: ${path}` }], details: { file, path } };
		},
	});

	pi.registerTool({
		name: "minimax_generate_music",
		label: "MiniMax Generate Music",
		description: "Generate music using MiniMax Token Plan.",
		parameters: Type.Object({
			prompt: Type.String(),
			lyrics: Type.Optional(Type.String()),
			model: Type.Optional(Type.String()),
			instrumental: Type.Optional(Type.Boolean()),
			output_mode: Type.Optional(OutputModeSchema),
			output_path: Type.Optional(Type.String()),
			format: Type.Optional(AudioFormatSchema),
			allow_overwrite: Type.Optional(Type.Boolean()),
		}),
		async execute(_id, params, signal, _update, ctx) {
			const prompt = required(params.prompt, "Prompt");
			const outputMode: OutputMode = params.output_mode === "local" ? "local" : "url";
			const format = params.format ?? "mp3";
			const data = await requestJson<unknown>(ctx, "/v1/music_generation", {
				method: "POST",
				body: {
					model: params.model ?? "music-3.0",
					prompt,
					lyrics: params.lyrics,
					is_instrumental: params.instrumental,
					audio_setting: { format },
					output_format: outputMode === "url" ? "url" : "hex",
				},
				signal,
			});
			const audio = objectField(objectField(data, "data"), outputMode === "url" ? "audio_url" : "audio");
			if (typeof audio !== "string") throw new Error("No music audio returned from MiniMax.");
			if (outputMode === "url") return { content: [{ type: "text", text: `Music URL: ${audio}` }], details: data };
			const path = await writeAudio(audio, {
				outputPath: params.output_path,
				cwd: ctx.cwd,
				format,
				text: prompt,
				allowOverwrite: params.allow_overwrite,
			});
			return { content: [{ type: "text", text: `Music saved to: ${path}` }], details: { data, path } };
		},
	});

	pi.registerTool({
		name: "minimax_quota",
		label: "MiniMax Quota",
		description: "Show MiniMax Token Plan quota and usage.",
		parameters: Type.Object({}),
		async execute(_id, _params, signal, _update, ctx) {
			const data = await requestJson<unknown>(ctx, "/v1/token_plan/remains", { signal });
			return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data };
		},
	});

	const api = anthropicMessagesApi();
	pi.registerProvider("minimax", {
		baseUrl: getMiniMaxApiBase(),
		apiKey: "$MINIMAX_API_KEY",
		api: "anthropic-messages",
		streamSimple: api.streamSimple,
		models: MODELS.map((model) => ({
			...model,
			input: [...model.input],
			...(model.id === "MiniMax-M3" ? { compat: { forceAdaptiveThinking: true } } : {}),
		})),
	});
}
