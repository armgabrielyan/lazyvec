# lazyvec — Agent Guide

Terminal UI for browsing vector databases. Built with OpenTUI React on Bun. See `README.md` for user-facing docs.

## Stack
- Runtime: Bun
- UI: `@opentui/react` (+ `@opentui/core`)
- Language: TypeScript (strict), React 19
- Tests: `bun:test` + `@opentui/react/test-utils`
- Config: `smol-toml`, stored at `~/.lazyvec/config.toml`

## Commands
- `bun run dev` — watch-mode dev server
- `bun run start` — run once
- `bun run typecheck` — `tsc --noEmit`
- `bun test` — all tests
- `bun test <file>` — one file while iterating
- `bun run build` — bundle to `dist/`

Run `typecheck` and `test` after any non-trivial change.

## Architecture

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

Data flow: `App.tsx` calls `app-data/*` which calls an adapter; results
dispatch reducer actions; `components/*` render from props.

## Coding Conventions
- TDD where applicable: write a focused failing test, then implement.
- Prefer adding to an existing file over creating one; split only when a
  file stops being cohesive (e.g. `qdrant-stats.ts` split from `qdrant.ts`).
- Layout/formatting logic is pure and lives in `src/layout/`.
- No comments on every line — only for non-obvious WHY.
- Fields that don't apply should be `undefined`, not defaulted zeros.
- Use `toErrorMessage()` from `format.ts` for user-facing error strings.
- New keybindings go in `use-app-keyboard.ts` AND the help overlay in
  `components/MainView.tsx` (`mainHelpSections` / `connectionHelpSections`).
  Keep help action labels ≤ `helpActionWidth` characters.

## Adding a New Adapter
1. Extend `AdapterCapabilities` only if a new cross-cutting capability
   appears. Otherwise existing flags are enough.
2. Implement `VectorDBAdapter`. Provider-specific parsing lives in a
   sibling module (see `qdrant-stats.ts`).
3. Register in `adapters/registry.ts`.
4. Unit-test the mapper and the capability block; UI tests come for free.

## Adding State
1. Extend `AppState` + initial values in `createInitialState`.
2. Add a new `AppAction` variant and a reducer case. Keep the reducer
   pure — all I/O stays in `App.tsx` / `app-data/`.
3. Add a focused reducer test in `src/state/app-state.test.ts`.

## OpenTUI Gotchas
- Do NOT call `process.exit()`. Quit via `renderer.destroy()`.
- Quit keys like `q` must be gated on text-input modes (connection form,
  filter bar) or they'll exit while typing. `Ctrl+C` is always unconditional.
- `key.eventType === "release"` events should early-return.
- Use `scrollbox` for content that can exceed the pane.
- Paste handling goes through `renderer.keyInput.on("paste", ...)` and
  `routePaste` in `state/app-state.ts` (bracketed-paste markers are stripped).

## Documentation
- Keep documentation in lockstep with code. Any behavior change, new feature,
  config field, keybinding, or capability MUST be reflected in the same
  change:
  - `README.md` — user-facing usage, config syntax, keys. note when they ship; remove them from the open list.
  - `AGENTS.md` (this file) — when a convention, architectural boundary, or workflow rule changes.
- Do not defer doc updates to a follow-up. Treat out-of-date docs as a bug.

## Planning & Commits
- Break non-trivial work into explicit steps; verify each before moving on.
- Conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`).
- Only commit when explicitly asked.
