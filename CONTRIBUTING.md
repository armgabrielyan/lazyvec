# Contributing to lazyvec

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#-development-setup)
- [Project Layout](#-project-layout)
- [Making Changes](#-making-changes)
- [Commit Messages](#-commit-messages)
- [Testing](#-testing)
- [Adding a New Adapter](#-adding-a-new-adapter)
- [Documentation](#-documentation)
- [Submitting a Pull Request](#-submitting-a-pull-request)
- [Code Style](#-code-style)
- [Release Process](#-release-process)

## 🔧 Development Setup

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.3 and Git.

```bash
git clone https://github.com/armgabrielyan/lazyvec
cd lazyvec
bun install
```

Everyday commands:

```bash
bun run dev        # Watch mode — auto-reload on source change
bun run start      # Run once
bun run typecheck  # tsc --noEmit
bun test           # Full test suite
bun test <file>    # Run one test file while iterating
bun run build      # Bundle to dist/
```

Spin up a scratch vector database for local testing:

```bash
# Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Chroma
bunx chroma run --path ./scratch/chroma-data --host localhost --port 8000
```

## 📁 Project Layout

```
src/
  adapters/        Provider SDKs behind a common VectorDBAdapter interface
                   with an AdapterCapabilities flag-bag. New providers
                   implement this; the UI reads capabilities instead of
                   hardcoding provider names.
  app-data/        Thin async helpers around adapter calls (no UI, no state)
  components/      OpenTUI React components — presentational
  config/          Config file I/O, validation, reachability ping
  filter/          Filter syntax parser (key:value, key:>N, etc.)
  layout/          PURE formatting/layout helpers, fully unit-tested
  state/           useReducer state + typed actions (AppState / AppAction)
  App.tsx          Orchestrator: owns adapter ref, wires effects, dispatches
  use-app-keyboard.ts  Keyboard routing (modal-aware: text input > modes > screens)
```

Data flow: `App.tsx` calls `app-data/*` which calls an adapter; results dispatch reducer actions;
`components/*` render from props.

See [`AGENTS.md`](./AGENTS.md) for deeper conventions.

## ✏️ Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Add tests (see [Testing](#-testing))
5. Ensure typecheck and tests pass: `bun run typecheck && bun test`
6. Commit following the [commit message conventions](#-commit-messages)
7. Open a pull request

## 💬 Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `test` | Adding or updating tests |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvements |
| `chore` | Build process, dependency updates, tooling |
| `ci` | CI configuration changes |

### Examples

```
feat: add Chroma Cloud support with tenant/database form fields
fix: read metric from SPANN config for Chroma Cloud collections
docs: update README with provider-aware form screenshot
test: add filter-translation coverage for Chroma $and composition
refactor: split qdrant-stats into its own module
```

### Breaking Changes

Append `!` after the type or add `BREAKING CHANGE:` in the footer:

```
feat!: rename --api-key flag to --token

BREAKING CHANGE: --api-key has been renamed to --token for consistency.
```

## 🧪 Testing

All new functionality and bug fixes **must** include tests. The suite runs under
[`bun:test`](https://bun.sh/docs/cli/test) with OpenTUI's React test utils for UI.

### Where tests live

| Location | What to test |
|----------|--------------|
| `src/<module>.test.ts` | Pure logic: filters, layout helpers, config parsing, reducer actions |
| `src/adapters/<provider>.test.ts` | Adapter behavior with a mocked `<Provider>ClientLike` |
| `src/adapters/<provider>-filter.test.ts` | Filter-to-SDK translation |
| `src/state/app-state.test.ts` | Reducer transitions |
| `src/App.test.tsx` | End-to-end UI flows via OpenTUI's test renderer |

### Running tests

```bash
# Full suite
bun test

# Single file
bun test src/adapters/chroma.test.ts

# Match by test name
bun test -t "listCollections"

# With verbose output
bun test --verbose
```

### What to test

- **New filter operators** — add cases in the filter parser tests *and* the per-adapter filter test
- **Adapter changes** — test against the `<Provider>ClientLike` mock; don't hit real SDKs
- **New reducer actions** — add a focused reducer test in `src/state/app-state.test.ts`
- **New keybindings** — add a case in `src/use-app-keyboard.ts`'s routing tests
- **Config parser changes** — cover env-var interpolation, validation errors, and the happy path

### What not to test directly

- Live network calls to provider APIs (mock the `ClientLike` instead)
- Terminal rendering pixel-exact (use semantic queries on OpenTUI's test renderer)

## 🔌 Adding a New Adapter

lazyvec adapters share a small, declarative surface. To add one:

1. **Scope capabilities.** Extend `AdapterCapabilities` in `src/adapters/types.ts` *only* if you're
   introducing a genuinely new cross-cutting capability. Otherwise the existing flags are enough.
2. **Implement the client seam.** Create `src/adapters/<provider>-client.ts` exposing a
   `<Provider>ClientLike` interface plus a `create<Provider>Client` factory. Keep the SDK-specific
   parsing here so the adapter stays testable.
3. **Implement the adapter.** Create `src/adapters/<provider>.ts` with a class that implements
   `VectorDBAdapter`. Provider-specific parsing (e.g. stats translation) can live in a sibling
   module — see `qdrant-stats.ts` for the pattern.
4. **Translate filters.** Add `src/adapters/<provider>-filter.ts` with a `to<Provider>Filter()`
   helper and unit tests.
5. **Register.** Add the factory to `defaultFactories` in `src/adapters/registry.ts`.
6. **Wire config.** Update `supportedProviders` / `urlRequiredProviders` in
   `src/config/connections.ts` and the visible fields in
   `src/components/ConnectionForm.tsx#visibleFieldKeys`. If CLI quick-connect should accept
   provider-specific flags, wire them in `parseCliConnection`.
7. **Reachability.** Add a branch in `src/config/connection-status.ts` for the provider's health
   endpoint.
8. **Test.** Add unit tests for the client wrapper, the adapter (with a mocked client), the filter
   helper, and config parsing.
9. **Document.** Add a Providers subsection to the README and update the Roadmap.

## 📚 Documentation

Keep documentation in **lockstep** with code. Any behavior change, new feature, config field,
keybinding, or capability MUST be reflected in the same change:

- **`README.md`** — user-facing usage, config syntax, keys. When a roadmap item ships, move it out
  of the open list.
- **`AGENTS.md`** — update when a convention, architectural boundary, or workflow rule changes.

Out-of-date docs are treated as a bug.

## 📬 Submitting a Pull Request

- Keep PRs focused — one feature or fix per PR
- Reference any related issues in the description
- Run `bun run typecheck && bun test` locally and include the result in the PR description
- Update documentation in the same PR
- A maintainer will review and merge your PR

## 🎨 Code Style

- **Type hints required** for all code (TypeScript strict mode)
- **Public APIs must have a short doc comment** — only for the non-obvious "why"
- **No line-by-line comments** — descriptive names and small functions do the job
- **Early returns** over nested conditions
- **Pure functions** for layout and formatting — live in `src/layout/`
- **`undefined` over defaulted zeros** for fields that don't apply
- **Use `toErrorMessage()` from `src/format.ts`** for user-facing error strings
- **New keybindings** go in `use-app-keyboard.ts` *and* the help overlay in
  `components/MainView.tsx` (`mainHelpSections` / `connectionHelpSections`). Keep help action
  labels ≤ `helpActionWidth` characters.

### OpenTUI gotchas

- Do **not** call `process.exit()`. Quit via `renderer.destroy()`.
- Quit keys like `q` must be gated on text-input modes or they'll exit while typing.
  `Ctrl+C` is always unconditional.
- Early-return on `key.eventType === "release"` events.
- Use `scrollbox` for content that can exceed the pane.
- Paste handling goes through `renderer.keyInput.on("paste", ...)` and `routePaste` in
  `state/app-state.ts` (bracketed-paste markers are stripped).

## 🚢 Release Process

Releases are triggered by pushing a `vX.Y.Z` tag. A tag push runs
[`.github/workflows/release.yml`](./.github/workflows/release.yml), which:

1. Cross-compiles prebuilt binaries with `bun build --compile` for five targets
   (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`).
2. Packages each as a tarball (or zip for Windows) and uploads it.
3. Generates release notes from Conventional Commits via
   [`git-cliff`](https://git-cliff.org/) using [`cliff.toml`](./cliff.toml).
4. Creates the GitHub Release with the binaries + `SHA256SUMS.txt` attached.
5. Publishes the [npm wrapper](./npm) — its `postinstall` downloads the binary matching
   `package.json#version` from the GitHub Release.

### Cutting a release

```bash
# 1. Make sure main is clean and CI is green.
git checkout main && git pull

# 2. Bump the version in package.json (no commit, no tag yet).
VERSION=0.2.0
bun x npm version "$VERSION" --no-git-tag-version

# 3. Regenerate CHANGELOG.md from the tags.
bunx git-cliff --tag "v$VERSION" -o CHANGELOG.md

# 4. Commit + tag.
git add package.json CHANGELOG.md
git commit -m "chore(release): v$VERSION"
git tag -a "v$VERSION" -m "Release v$VERSION"

# 5. Push — the Release workflow takes over.
git push origin main
git push origin "v$VERSION"
```

### Credentials the workflow needs

| Credential | Purpose |
|------------|---------|
| `GITHUB_TOKEN` | Provided automatically; used by `softprops/action-gh-release` |
| npm trusted publisher | OIDC-based; no secret required (see setup below) |

#### npm trusted publisher (one-time setup)

npm supports short-lived OIDC tokens in place of long-lived automation tokens.
The workflow uses this via `npm publish --provenance` + `id-token: write`, which
means **no `NPM_TOKEN` secret is needed** at the repo level.

Register the trusted publisher on npmjs.com:

1. Sign in to [npmjs.com](https://www.npmjs.com/) and open the `lazyvec` package page.
2. **Settings → Trusted Publishers → Add Publisher**.
3. Fill in:
   - Publisher: **GitHub Actions**
   - Organization/user: `armgabrielyan`
   - Repository: `lazyvec`
   - Workflow filename: `release.yml`
   - Environment: *(leave blank)*
4. Save.

Publishes from the release workflow will now mint an OIDC token at runtime,
authenticate against npm, and attach a provenance statement visible on the
package page (a green "Published via GitHub Actions" badge).

If the package has never been published, do the first release from your local
machine with `cd npm && npm publish --access public` after running `npm login`;
subsequent releases will go through Actions automatically.

### Branch protection

`main` should require:

- The **CI / Typecheck + Tests** check to pass
- PRs before merge (no direct pushes)
- Linear history (optional but recommended)

Configure under **Settings → Branches → Branch protection rules** for `main`.
