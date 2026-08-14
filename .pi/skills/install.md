---
name: install
description: Use when the user asks to "/install", install pi locally, or build an isolated local release. Runs `npm run release:local` into `/tmp/pi-local-release` and smoke-tests it outside the workspace.
---

# Install Locally

Build an unpublished release of the `pi` monorepo and install it into an isolated directory outside the repo, then smoke-test the result. This is the workflow in `AGENTS.md#releasing`, adapted as a contributor convenience.

## When to use

- The user asks `/install`, "install locally", "build locally", or similar.
- They want to test their current changes against a packaged CLI without resolving workspace files.

## Steps

1. Confirm the cwd is the pi monorepo root (`packages/`, `package.json` with workspaces present).
2. Run the local release build:
   ```bash
   npm run release:local -- --out /tmp/pi-local-release --force
   ```
   The script runs `npm run check` and `./test.sh` first. If either fails on unrelated, pre-existing flakes, rerun with `--skip-test` (and/or `--skip-check`) after confirming with the user that the failures are not regressions from current changes.
3. Smoke-test both runtimes from outside the repo:
   ```bash
   /tmp/pi-local-release/node/pi --version
   /tmp/pi-local-release/bun/pi --version
   /tmp/pi-local-release/node/pi --help | head
   ```
4. Report the version printed by each binary and the install path.

## Output locations

After the build, `/tmp/pi-local-release` contains:

```
/tmp/pi-local-release/
  node/pi          # isolated npm install
  bun/pi           # Bun binary
  bun-install/pi   # Bun package install
  tarballs/*.tgz   # packed workspace packages
```

## Notes

- The build can be slow on first run (full type-check, vitest, esbuild). Allow several minutes.
- `packages/ai/src/image-models.generated.ts` may regenerate during the run. It is unrelated to user changes; revert it before committing (`git checkout packages/ai/src/image-models.generated.ts`).
- Do not push or commit the release artifacts — they live under `/tmp` and are outside the repo.
