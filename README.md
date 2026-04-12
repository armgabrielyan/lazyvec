# lazyvec

A terminal UI for browsing and inspecting vector databases.

The current implementation is the v0.1 OpenTUI shell with a Qdrant read-only adapter. It starts
with a connection picker, then loads collections and records from the selected connection.

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
| `Enter` | Connect, move from collections to records, or fetch vector details for the selected record |
| `n` / `PageDown` | Load the next record page |
| `Tab` / `Shift+Tab` | Cycle main-view panel focus |
| `[` / `]` | Resize the collection panel |
| `c` | Return to the connection picker |
| `r` | Refresh the current collection |
| `?` | Toggle help |
