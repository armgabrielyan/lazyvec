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
| `/` | Open filter bar |
| `s` | Find similar records (vector search) |
| `y i` | Copy record ID to clipboard |
| `y m` | Copy metadata (JSON) to clipboard |
| `y v` | Copy vector (JSON) to clipboard |
| `Esc` | Close filter bar / clear search / clear filter / back to connections |
| `c` | Return to the connection picker |
| `r` | Refresh the current collection |
| `?` | Toggle help |

## Dynamic Columns

The record table automatically samples loaded records to infer a metadata schema and displays
the most useful fields as columns. Fields are ranked by non-null rate, value length, and type.
Long values are truncated, and column widths are distributed proportionally based on content.

## Find Similar

Press `s` on a selected record to search for similar records by vector. If the record's vector
hasn't been fetched yet, it is loaded automatically before searching. Results are displayed with
a score column showing similarity. Press `Esc` to return to the normal record list.

## Copy / Yank

Press `y` to enter yank mode, then press a second key to choose what to copy:

- `y i` — record ID
- `y m` — metadata as JSON
- `y v` — vector as JSON array (must be fetched first via `Enter`)

Press `Esc` or any other key to cancel. Works on macOS (`pbcopy`), Linux (`xclip`), and
Windows (`clip`).

## Filtering

Press `/` to open the filter bar, type a filter expression, and press `Enter` to apply.
The filter bar stays open so you can refine or add more conditions. Press `Esc` to close
the bar (the filter remains active), and `Esc` again to clear it.

### Syntax

| Pattern | Meaning |
| --- | --- |
| `key:value` | Exact match (string or number) |
| `key:"value with spaces"` | Exact match with quoted value |
| `key:>N` | Greater than |
| `key:>=N` | Greater than or equal |
| `key:<N` | Less than |
| `key:<=N` | Less than or equal |
| `key:!=value` | Not equal |
| `id:123` | Point ID lookup |

Multiple filters are space-separated and combined with AND logic:

```
status:active count:>10 name:"Gjon Mili"
```
