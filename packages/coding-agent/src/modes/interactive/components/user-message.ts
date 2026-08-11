import { Box, Container, Markdown, type MarkdownTheme, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { MarkdownTransformer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message
 */
export class UserMessageComponent extends Container {
	private text: string;
	private markdownTheme: MarkdownTheme;
	private outputPad: number;
	private markdownTransformers: readonly MarkdownTransformer[];

	constructor(
		text: string,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		outputPad = 1,
		markdownTransformers: readonly MarkdownTransformer[] = [],
	) {
		super();
		this.text = text;
		this.markdownTheme = markdownTheme;
		this.outputPad = outputPad;
		this.markdownTransformers = markdownTransformers;
		this.rebuild();
	}

	setOutputPad(padding: number): void {
		this.outputPad = padding;
		this.rebuild();
	}

	private rebuild(): void {
		this.clear();
		const contentBox = new Box(this.outputPad, 1, (content: string) => theme.bg("userMessageBg", content));
		contentBox.addChild(
			new Markdown(
				this.text,
				0,
				0,
				this.markdownTheme,
				{
					color: (content: string) => theme.fg("userMessageText", content),
				},
				{
					preserveOrderedListMarkers: true,
					preserveBackslashEscapes: true,
					transform: createMarkdownTransform("user", false, this.markdownTransformers),
				},
			),
		);
		this.addChild(contentBox);
	}

	override render(width: number): string[] {
		if (width < 8) {
			return super.render(width);
		}

		const innerWidth = width - 2;
		const contentWidth = innerWidth - 2;
		const lines = super.render(contentWidth);
		if (lines.length === 0) {
			return lines;
		}

		const title = " user ";
		const top = `${theme.fg("border", "╭")}${theme.fg("accent", theme.bold(title))}${theme.fg("border", `${"─".repeat(Math.max(0, innerWidth - visibleWidth(title)))}╮`)}`;
		const bottom = `${theme.fg("border", "╰")}${theme.fg("border", `${"─".repeat(innerWidth)}╯`)}`;
		const body = lines.map((line) => {
			const content = truncateToWidth(line, contentWidth, "", true);
			const padding = " ".repeat(Math.max(0, contentWidth - visibleWidth(content)));
			return `${theme.fg("border", "│")} ${content}${padding} ${theme.fg("border", "│")}`;
		});
		const box = [top, ...body, bottom].map((line) => theme.bg("userMessageBg", line));
		box[0] = OSC133_ZONE_START + box[0];
		box[box.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + box[box.length - 1];
		return box;
	}
}
