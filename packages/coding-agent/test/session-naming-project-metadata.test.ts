import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectProjectMetadata, formatProjectMetadata } from "../src/extensions/session-naming/project-metadata.ts";

async function fixture(files: Record<string, string>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-session-project-meta-"));
	for (const [path, content] of Object.entries(files)) {
		const full = join(dir, path);
		await mkdir(join(full, ".."), { recursive: true });
		await writeFile(full, content);
	}
	return dir;
}

describe("collectProjectMetadata", () => {
	it("reads a scoped npm package name", async () => {
		const dir = await fixture({
			"package.json": JSON.stringify({ name: "@furbyhaxx/pi-session-naming" }),
		});

		expect(collectProjectMetadata(dir)).toEqual([
			{ source: "package.json", ecosystem: "node", name: "@furbyhaxx/pi-session-naming" },
		]);
	});

	it("reads rust, python, dart, and go manifests in detector order", async () => {
		const dir = await fixture({
			"Cargo.toml": '[package]\nname = "furbyhaxx-core"\nversion = "0.1.0"\n',
			"pyproject.toml": '[project]\nname = "furbyhaxx-tools"\n',
			"pubspec.yaml": "name: furbyhaxx_app\nversion: 1.0.0\n",
			"go.mod": "module github.com/furbyhaxx/pi-session-naming\n\ngo 1.23\n",
		});

		expect(collectProjectMetadata(dir)).toEqual([
			{ source: "Cargo.toml", ecosystem: "rust", name: "furbyhaxx-core" },
			{ source: "pyproject.toml", ecosystem: "python", name: "furbyhaxx-tools" },
			{ source: "pubspec.yaml", ecosystem: "dart", name: "furbyhaxx_app" },
			{ source: "go.mod", ecosystem: "go", name: "github.com/furbyhaxx/pi-session-naming" },
		]);
	});

	it("reads poetry, php, jvm, gradle, ruby, elixir, and deno manifests", async () => {
		const dir = await fixture({
			"pyproject.toml": '[tool.poetry]\nname = "poetry-app"\n',
			"composer.json": JSON.stringify({ name: "furbyhaxx/php-app" }),
			"pom.xml": "<project><groupId>de.furbyhaxx</groupId><artifactId>jvm-app</artifactId></project>",
			"settings.gradle": "rootProject.name = 'gradle-app'\n",
			"example.gemspec": 'Gem::Specification.new do |spec|\n  spec.name = "ruby-gem"\nend\n',
			"mix.exs": 'def project do\n  [app: :elixir_app, version: "0.1.0"]\nend\n',
			"deno.json": JSON.stringify({ name: "deno-tool" }),
		});

		expect(collectProjectMetadata(dir)).toEqual([
			{ source: "pyproject.toml", ecosystem: "python", name: "poetry-app" },
			{ source: "composer.json", ecosystem: "php", name: "furbyhaxx/php-app" },
			{ source: "pom.xml", ecosystem: "jvm", name: "de.furbyhaxx:jvm-app" },
			{ source: "settings.gradle", ecosystem: "gradle", name: "gradle-app" },
			{ source: "example.gemspec", ecosystem: "ruby", name: "ruby-gem" },
			{ source: "mix.exs", ecosystem: "elixir", name: "elixir_app" },
			{ source: "deno.json", ecosystem: "deno", name: "deno-tool" },
		]);
	});
});

describe("formatProjectMetadata", () => {
	it("renders ecosystem:name (source) pairs", () => {
		expect(
			formatProjectMetadata([
				{ source: "Cargo.toml", ecosystem: "rust", name: "furbyhaxx-core" },
				{ source: "pyproject.toml", ecosystem: "python", name: "furbyhaxx-tools" },
			]),
		).toBe("rust:furbyhaxx-core (Cargo.toml), python:furbyhaxx-tools (pyproject.toml)");
	});
});
