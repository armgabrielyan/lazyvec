# lazyvec

A terminal UI for browsing and inspecting vector databases.

Built with OpenTUI React and Bun. Supports Qdrant, Pinecone, and Chroma. Start with a connection
picker, browse collections and records, inspect metadata and vectors, search for similar records,
and delete entries — all without leaving the terminal.

## Run

```bash
bun install
bun run start
```

With no config file, lazyvec shows setup guidance instead of assuming a database is running locally.
Add connections at `~/.lazyvec/config.toml`:

```toml
[connections.local-qdrant]
provider = "qdrant"
url = "http://localhost:6333"

[connections.cloud-pinecone]
provider = "pinecone"
api_key = "pcsk-..."

[connections.local-chroma]
provider = "chroma"
url = "http://localhost:8000"
```

Secrets can be interpolated from environment variables using `${VAR}` inside `api_key` or
`url`. The env var must be set — lazyvec fails fast with a clear error if it's missing:

```toml
[connections.cloud-pinecone]
provider = "pinecone"
api_key = "${PINECONE_API_KEY}"

[connections.cloud-qdrant]
provider = "qdrant"
url = "${QDRANT_URL}"
api_key = "${QDRANT_API_KEY}"
```

Opening Edit on an env-referenced connection shows the literal `${VAR}` in the form, so
saving preserves the reference.

Or use quick-connect flags:

```bash
bun run start -- --provider qdrant --url http://localhost:6333
bun run start -- --provider pinecone --api-key pcsk-...
bun run start -- --provider chroma --url http://localhost:8000
```

### Pinecone

Pinecone support is serverless-only in this release. Pod-based indexes list in the collections
pane, but opening one for browsing surfaces a clear error. Each `index/namespace` pair appears as
a separate collection row; indexes with only the default namespace appear under the bare index
name.

Pinecone metadata filtering is not wired into the record-list filter bar yet — use `id:<value>`
to look up a specific record. In the Add/Edit Connection form, focus the Provider field and use
`←` / `→` (or `space`) to switch between `qdrant`, `pinecone`, and `chroma`. Pinecone requires an
API Key; the URL field is unused.

### Chroma

Chroma works in two modes:

**Local server** (`chroma run`). Set `url` to the server (e.g. `http://localhost:8000`). If your
deployment enforces a token, set `api_key` — lazyvec forwards it as the `x-chroma-token` header.

**Chroma Cloud**. Omit `url` and set `api_key` to your cloud token. Optionally set `tenant` and
`database` to target a specific workspace; without them lazyvec uses the SDK defaults. The Add/Edit
Connection form exposes Tenant and Database fields directly — they only apply to the `chroma`
provider and are ignored otherwise.

```toml
[connections.chroma-cloud]
provider = "chroma"
api_key = "${CHROMA_API_KEY}"
tenant = "your-tenant-uuid"
database = "prod"
```

Quick-connect also supports Cloud flags:

```bash
bun run start -- --provider chroma --api-key ck-... --tenant your-tenant --database prod
```

Chroma doesn't persist vector dimensions at the collection level, so lazyvec infers them by
peeking at the first record. Empty collections therefore show `dim 0` until records are added.
Distances returned by similarity search are raw Chroma distances (cosine/l2/ip), not scores —
smaller is closer.

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
| `d` | Delete selected record(s) with confirmation |
| `V` | Enter visual selection mode |
| `y i` | Copy record ID to clipboard |
| `y m` | Copy metadata (JSON) to clipboard |
| `y v` | Copy vector (JSON) to clipboard |
| `Esc` | Cancel visual select / close filter / clear search / clear filter / back |
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

## Delete

Press `d` on a selected record to delete it. A confirmation dialog appears — press `Enter`
to confirm or `Esc` to cancel. This action cannot be undone.

### Visual Selection

Press `V` (shift+v) to enter visual selection mode. Move with `j`/`k` to extend the range,
or `Space` to toggle individual records. Selected records are highlighted. Press `d` to delete
all selected records, or `Esc` to cancel the selection.

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
