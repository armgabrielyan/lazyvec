# lazyvec

A terminal UI for browsing and inspecting vector databases.

The current implementation is the v0.1 OpenTUI shell with mock Qdrant data. It starts with a
connection picker, then shows the three-panel collection, record, and inspector layout.

## Run

```bash
bun install
bun run start
```

With no config file, lazyvec shows setup guidance instead of assuming Qdrant is running locally.
Add a connection at `~/.lazyvec/config.toml`:

```toml
[connections.local-qdrant]
provider = "qdrant"
url = "http://localhost:6333"
```

Or use quick-connect flags:

```bash
bun run start -- --provider qdrant --url http://localhost:6333
```

## Keys

| Key | Action |
| --- | --- |
| `q` / `Ctrl+C` | Quit |
| `j` / `k` or arrows | Move selection |
| `Enter` | Connect or inspect/select |
| `Tab` / `Shift+Tab` | Cycle main-view panel focus |
| `c` | Return to the connection picker |
| `r` | Refresh mock data |
| `?` | Toggle help |
