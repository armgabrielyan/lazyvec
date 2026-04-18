# Demo tapes

[VHS](https://github.com/charmbracelet/vhs) scripts that drive the lazyvec TUI
and render animated GIFs into `demo/*.gif`. The GIFs are what the project
`README.md` embeds.

## Prerequisites

```bash
brew install vhs      # macOS
# or see https://github.com/charmbracelet/vhs for other platforms

# VHS uses ttyd + ffmpeg under the hood; brew install pulls them automatically.
```

You also need a local **Chroma** server and **bun** — `setup.sh` boots Chroma
for you if it isn't already running, and seeds `movies` / `articles`
collections via `scratch/seed-chroma.ts`.

## Recording

Run VHS from the **repo root** so the relative paths (`demo/tapes/settings.tape`,
`demo/snap.gif`, etc.) resolve correctly.

```bash
# One tape at a time
vhs demo/tapes/overview.tape

# Everything
for t in demo/tapes/*.tape; do
  [ "$(basename "$t")" = "settings.tape" ] && continue
  vhs "$t"
done
```

Each tape overwrites its `demo/*.gif` output. Commit the GIFs alongside the
tape changes so the README always shows the current behavior.

## What each tape shows

| Tape | Feature |
|------|---------|
| `overview.tape` | Hero overview — connect, browse, inspect |
| `connections.tape` | Connection picker + provider-aware Add form |
| `filter.tape` | Filter bar (`key:value` + numeric ranges) |
| `similar.tape` | Vector similarity search (`s`) |
| `delete.tape` | Single + visual-range delete with confirmation |
| `yank.tape` | Copy record ID / metadata / vector |
| `settings.tape` | Shared VHS settings (sourced by the rest) |
| `setup.sh` | Boots Chroma + seeds data + writes a sandbox config |

## Sandboxed demo environment

`setup.sh` exports `HOME=/tmp/lazyvec-demo-home` for the tape session, so the
demo config file never touches your real `~/.lazyvec/`. The sandbox contains a
single preconfigured connection:

```toml
default = "local-chroma"

[connections.local-chroma]
provider = "chroma"
url = "http://localhost:8000"
```

## Adding a new tape

1. Copy an existing tape (e.g. `filter.tape`) and adjust the keystrokes.
2. Start with `Source demo/tapes/settings.tape` and the `Hide ... setup.sh ... Show`
   block so the demo repo is always deterministic.
3. Pick an `Output demo/<name>.gif` path and reference it from the root
   `README.md`.
