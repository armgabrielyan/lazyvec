# lazyvec

A terminal UI for browsing and inspecting vector databases.

The current implementation is the v0.1 OpenTUI shell with mock Qdrant data. It starts with a
connection picker, then shows the three-panel collection, record, and inspector layout.

## Run

```bash
bun install
bun run start
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
