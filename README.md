# lazyvec

[![CI](https://github.com/armgabrielyan/lazyvec/actions/workflows/ci.yml/badge.svg)](https://github.com/armgabrielyan/lazyvec/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/lazyvec)](https://www.npmjs.com/package/lazyvec)
[![npm downloads](https://img.shields.io/npm/dm/lazyvec)](https://www.npmjs.com/package/lazyvec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A terminal UI for browsing vector databases.**

## Table of Contents

- [Demo](#demo)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
  - [Connection Fields](#connection-fields)
  - [Environment Variables](#environment-variables)
  - [Default Connection](#default-connection)
- [Providers](#-providers)
  - [Qdrant](#qdrant)
  - [Pinecone](#pinecone)
  - [Chroma](#chroma)
- [Usage](#-usage)
  - [Connection Picker](#connection-picker)
  - [Add / Edit / Delete Connections](#add--edit--delete-connections)
  - [Browse Collections](#browse-collections)
  - [Collection Stats](#collection-stats)
  - [Filter Records](#filter-records)
  - [Find Similar (Vector Search)](#find-similar-vector-search)
  - [Delete Records](#delete-records)
  - [Visual Selection](#visual-selection)
  - [Copy / Yank](#copy--yank)
- [Key Bindings](#-key-bindings)
- [Dynamic Columns](#-dynamic-columns)
- [Safety Features](#-safety-features)
- [Requirements](#-requirements)
- [Roadmap](#-roadmap)
- [License](#-license)
- [Contributing](#-contributing)

`lazyvec` is a terminal UI for browsing, inspecting, and pruning vector databases. Connect to
[Qdrant](https://qdrant.tech), [Pinecone](https://pinecone.io), or [Chroma](https://trychroma.com)
(local server or Chroma Cloud), pick a collection, and explore records, metadata, and vectors —
all without leaving the terminal.

## Demo

![lazyvec overview](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/overview.gif)

All demo GIFs are generated from [VHS tapes](./demo/tapes) — see
`demo/tapes/README.md` for how to regenerate them.

## ✨ Features

- 🔌 **Multi-provider** — Qdrant (local + Cloud), Pinecone (serverless), and Chroma (local + Cloud) behind a common adapter interface
- 📋 **Connection picker** — Pick from a list of configured connections with inline reachability checks
- ✏️ **Add / Edit / Delete** — Manage connections from the UI; form fields adapt to the selected provider
- 📂 **Browse** — Paginated collection and record views with metadata inspection
- 🔍 **Filter** — `key:value`, `key:>N`, `id:123` syntax with AND composition
- 🎯 **Find similar** — Vector similarity search from any selected record
- 🗑️ **Delete** — Single or visual-range record deletion with confirmation
- 📊 **Stats** — Per-collection vector config, counts, index details, namespaces (where supported)
- 📋 **Copy/Yank** — Vim-style `y{i,m,v}` to copy ID, metadata, or vector to the clipboard
- 🔐 **Env-var interpolation** — Reference secrets via `${VAR}` in `~/.lazyvec/config.toml`
- 🧩 **Dynamic columns** — Auto-infers record table columns from metadata schema

## 📦 Installation

### ⚡ Quick Install (macOS / Linux)

```bash
curl -sSf https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/install.sh | sh
```

Detects your OS/arch, downloads the matching binary from the latest
[GitHub Release](https://github.com/armgabrielyan/lazyvec/releases), verifies its SHA256, and
drops it into `~/.local/bin`. Pin a specific version with `LAZYVEC_VERSION=v0.2.0`.

### 📦 npm / npx

```bash
# Install globally
npm install -g lazyvec

# Or run once
npx lazyvec
```

The npm package is a thin wrapper — on install, a prebuilt binary matching your platform is
downloaded from the matching GitHub Release and checksum-verified.

### ⬇️ Manual Download

Grab a tarball (or `.zip` for Windows) from the [GitHub Releases](https://github.com/armgabrielyan/lazyvec/releases) page:

| Platform | Architecture | Archive |
|----------|--------------|---------|
| macOS | Intel | `lazyvec-VERSION-darwin-x64.tar.gz` |
| macOS | Apple Silicon | `lazyvec-VERSION-darwin-arm64.tar.gz` |
| Linux | x86_64 | `lazyvec-VERSION-linux-x64.tar.gz` |
| Linux | ARM64 | `lazyvec-VERSION-linux-arm64.tar.gz` |
| Windows | x86_64 | `lazyvec-VERSION-windows-x64.zip` |

Each release also includes `SHA256SUMS.txt`.

### 🔨 From Source

Prerequisites: [Bun](https://bun.sh) ≥ 1.3.

```bash
git clone https://github.com/armgabrielyan/lazyvec
cd lazyvec
bun install
bun run start
```

Useful scripts:

```bash
bun run dev        # Watch mode
bun run start      # Run once
bun run typecheck  # tsc --noEmit
bun test           # Run the test suite
bun run build      # Bundle to dist/ (requires Bun runtime)
```

## 🚀 Quick Start

Without a config file, lazyvec opens on a setup screen with guidance — it does not assume a database
is running locally.

**Option 1: TOML config.** Create `~/.lazyvec/config.toml`:

```toml
default = "local-qdrant"

[connections.local-qdrant]
provider = "qdrant"
url = "http://localhost:6333"

[connections.cloud-pinecone]
provider = "pinecone"
api_key = "${PINECONE_API_KEY}"

[connections.local-chroma]
provider = "chroma"
url = "http://localhost:8000"

[connections.chroma-cloud]
provider = "chroma"
api_key = "${CHROMA_API_KEY}"
tenant = "${CHROMA_TENANT}"
database = "prod"
```

Then run:

```bash
bun run start
```

**Option 2: CLI quick-connect.** Skip the config file and pass flags:

```bash
# Qdrant
bun run start -- --provider qdrant --url http://localhost:6333

# Pinecone
bun run start -- --provider pinecone --api-key pcsk-...

# Chroma (local)
bun run start -- --provider chroma --url http://localhost:8000

# Chroma Cloud
bun run start -- --provider chroma --api-key ck-... --tenant <uuid> --database prod
```

CLI connections appear at the top of the picker, tagged as `cli`.

## ⚙️ Configuration

Config lives at `~/.lazyvec/config.toml`. Each connection is a `[connections.<name>]` table.

### Connection Fields

| Field | Providers | Description |
|-------|-----------|-------------|
| `provider` | all | One of `qdrant`, `pinecone`, `chroma` (required) |
| `url` | qdrant, chroma (local) | HTTP endpoint, e.g. `http://localhost:6333` |
| `api_key` | qdrant (cloud), pinecone, chroma | Auth token; required for Pinecone and Chroma Cloud |
| `tenant` | chroma only | Chroma Cloud tenant ID (optional) |
| `database` | chroma only | Chroma Cloud database name (optional) |

Validation rules:

- **Qdrant** requires `url`. `api_key` is optional (for Qdrant Cloud).
- **Pinecone** requires `api_key`. `url` is unused.
- **Chroma** requires `url` OR `api_key`. `tenant` / `database` are optional and only valid for chroma.

### Environment Variables

Any `api_key`, `url`, `tenant`, or `database` can reference `${VAR}` — the variable must be set, or
lazyvec fails fast with a clear error:

```toml
[connections.cloud-qdrant]
provider = "qdrant"
url = "${QDRANT_URL}"
api_key = "${QDRANT_API_KEY}"
```

Opening **Edit** on an env-referenced connection shows the literal `${VAR}` in the form, so saving
preserves the reference.

### Default Connection

Set `default = "<name>"` at the top of `config.toml` to pre-select a connection on startup.

## 🔌 Providers

### Qdrant

Full-featured adapter. Supports collection listing, describe, record pagination (with metadata
filters), get-by-id, vector search, delete, and rich stats (HNSW config, segments, payload
indexes, aliases). Works against both self-hosted and Qdrant Cloud.

**Local / self-hosted.** Set `url` to the server:

```toml
[connections.local-qdrant]
provider = "qdrant"
url = "http://localhost:6333"
```

**Qdrant Cloud.** Same shape, plus `api_key` (forwarded as the `api-key` header):

```toml
[connections.cloud-qdrant]
provider = "qdrant"
url = "https://xyz.cloud.qdrant.io:6333"
api_key = "${QDRANT_API_KEY}"
```

### Pinecone

Serverless-only in this release. Pod-based indexes are visible in the collections pane, but
browsing one surfaces a clear error. Each `index/namespace` pair appears as a separate row;
indexes with only the default namespace appear under the bare index name.

**Note:** Pinecone metadata filtering is not wired into the record-list filter bar yet — use
`id:<value>` to look up a specific record.

```toml
[connections.cloud-pinecone]
provider = "pinecone"
api_key = "${PINECONE_API_KEY}"
```

### Chroma

Supports two modes — the SDK surface is identical, only the connection shape differs.

**Local server** (`chroma run`). Set `url` to the server; set `api_key` if auth is enabled
(forwarded as `x-chroma-token`):

```toml
[connections.local-chroma]
provider = "chroma"
url = "http://localhost:8000"
```

**Chroma Cloud.** Omit `url` and set `api_key` to your cloud token. `tenant` and `database`
are optional — without them lazyvec uses the SDK-discovered defaults:

```toml
[connections.chroma-cloud]
provider = "chroma"
api_key = "${CHROMA_API_KEY}"
tenant = "your-tenant-uuid"
database = "prod"
```

**Caveats:**
- Chroma doesn't persist vector dimensions at the collection level, so lazyvec infers them by
  peeking at the first record. Empty collections show `dim 0` until records are added.
- Distances returned by similarity search are raw Chroma distances (cosine / l2 / ip) — smaller is
  closer (inverted from Qdrant and Pinecone).
- Both HNSW (local) and SPANN (Cloud default) index configurations are read for the metric field.

## 🛠️ Usage

### Connection Picker

On startup lazyvec opens a connection picker listing every connection from `config.toml` plus any
CLI quick-connects. Each row shows a live reachability indicator (pinged every 5 seconds).

Press `Enter` to connect. Press `a` / `e` / `d` to Add / Edit / Delete a connection (edit and
delete only apply to config-file connections; CLI connections are ephemeral).

### Add / Edit / Delete Connections

![Add Connection form](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/connections.gif)

The connection form is **provider-aware** — only the fields relevant to the selected provider are
shown:

| Provider | Visible fields |
|----------|----------------|
| qdrant | Name, Provider, URL, API Key |
| pinecone | Name, Provider, API Key |
| chroma | Name, Provider, URL, API Key, Tenant, Database |

- Focus the **Provider** field and use `←` / `→` (or `Space`) to switch providers.
- `Tab` / `Shift+Tab` cycles through visible fields only.
- `Enter` saves to `~/.lazyvec/config.toml`; `Esc` cancels.
- Editing an env-var connection (`${VAR}`) shows the literal reference, which is preserved on save.

### Browse Collections

After connecting, the main view shows three panels:

```
[ Collections ][ Records / Stats ][ Inspector ]
```

- `Tab` / `Shift+Tab` cycles panel focus.
- `[` / `]` resize the collection panel.
- `j` / `k` or arrows move the selection.
- `Enter` on a collection loads the first record page; `Enter` on a record fetches its vector
  into the inspector.
- `n` / `PageDown` loads the next record page.
- `r` refreshes the current collection.
- `c` returns to the connection picker.

### Collection Stats

With a collection selected, the right pane has a **Stats** tab showing:

- Status (ready / initializing / error)
- Point count, indexed vectors, segments (provider permitting)
- Vector config: dimensions, metric (`cosine` / `euclidean` / `dotproduct`)
- Index config (HNSW / SPANN parameters where available)
- Namespaces (Pinecone, Chroma)
- Aliases, payload indexes, quantization, sharding (Qdrant)

### Filter Records

![Filter bar demo](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/filter.gif)

Press `/` to open the filter bar, type an expression, and press `Enter` to apply. The bar stays
open so you can refine. `Esc` closes the bar (filter remains active); a second `Esc` clears it.

| Pattern | Meaning |
|---------|---------|
| `key:value` | Exact match (string or number) |
| `key:"value with spaces"` | Exact match with quoted value |
| `key:>N` / `key:>=N` | Greater than (or equal) |
| `key:<N` / `key:<=N` | Less than (or equal) |
| `key:!=value` | Not equal |
| `id:123` | Point ID lookup |

Multiple filters are space-separated and combined with **AND**:

```
status:active count:>10 name:"Gjon Mili"
```

**Provider support:**

| Provider | `id:` | field filters |
|----------|-------|--------------|
| Qdrant | ✅ | ✅ full (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`) |
| Pinecone | ✅ | ❌ (not wired yet — use `id:`) |
| Chroma | ✅ | ✅ full (translated to `$eq`, `$ne`, `$gt`…, `$and`) |

### Find Similar (Vector Search)

![Find similar demo](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/similar.gif)

Press `s` on a selected record to search for similar records by vector. If the record's vector
hasn't been fetched yet, it is loaded automatically before searching. Results display with a
score column. Press `Esc` to return to the normal record list.

### Delete Records

![Delete + visual select demo](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/delete.gif)

Press `d` on a selected record to delete it. A confirmation dialog appears — `Enter` confirms,
`Esc` cancels. Deletions are permanent.

### Visual Selection

Press `V` (Shift+V) to enter visual selection mode:

- `j` / `k` extends the range.
- `Space` toggles individual records.
- `d` deletes all selected records.
- `Esc` cancels the selection.

### Copy / Yank

![Yank demo](https://raw.githubusercontent.com/armgabrielyan/lazyvec/main/demo/yank.gif)

Vim-style yank — press `y` then a second key:

| Keys | Copies |
|------|--------|
| `y i` | Record ID |
| `y m` | Metadata as JSON |
| `y v` | Vector as JSON array (requires vector to be fetched via `Enter`) |

Works on macOS (`pbcopy`), Linux (`xclip`), and Windows (`clip`). Any other key cancels yank mode.

## ⌨️ Key Bindings

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit |
| `j` / `k` or arrows | Move selection |
| `Enter` | Connect, open a collection, or fetch vector for selected record |
| `n` / `PageDown` | Load the next record page |
| `Tab` / `Shift+Tab` | Cycle panel focus |
| `[` / `]` | Resize the collection panel |
| `/` | Open filter bar |
| `s` | Find similar records (vector search) |
| `d` | Delete selected record(s) |
| `V` | Enter visual selection mode |
| `y i` / `y m` / `y v` | Copy ID / metadata / vector |
| `a` / `e` / `d` | Add / Edit / Delete connection (picker) |
| `c` | Return to connection picker |
| `r` | Refresh current collection |
| `Esc` | Cancel visual select / close filter / clear search / back |
| `?` | Toggle help overlay |

`q` is gated on text-input contexts (forms, filter bar) so it doesn't quit while you're typing.
`Ctrl+C` is always unconditional.

## 📊 Dynamic Columns

The record table samples loaded records to infer a metadata schema and displays the most useful
fields as columns. Fields are ranked by non-null rate, value length, and type. Long values are
truncated; column widths are distributed proportionally based on content.

## 🛡️ Safety Features

lazyvec is a read-heavy tool with a small set of destructive actions. Guardrails:

| Feature | Description |
|---------|-------------|
| **Confirmation dialog** | Deletes always prompt (`Enter` to confirm, `Esc` to cancel) |
| **Visual select preview** | Highlighted rows show exactly what will be deleted |
| **Connection edit/delete scope** | Only config-file connections can be edited or deleted from the UI; CLI quick-connects are read-only |
| **Env-var literals preserved** | `${VAR}` references in config are retained on save — secrets never land in the TOML |
| **Reachability ping** | The picker runs a passive health check so you catch down hosts before connecting |
| **Pinecone pod-based guard** | Browsing a pod-based index fails with a clear error rather than silently sending bad queries |

## 📋 Requirements

- [Bun](https://bun.sh) ≥ 1.3
- A reachable Qdrant, Pinecone, or Chroma deployment
- Clipboard utility for yank: `pbcopy` (macOS), `xclip` (Linux), or `clip` (Windows)

## 🗺️ Roadmap

- [x] 🟦 Qdrant adapter (local + Qdrant Cloud)
- [x] 🟨 Pinecone adapter (serverless, namespace flattening)
- [x] 🟩 Chroma adapter (local + Chroma Cloud)
- [x] 🔐 Env-var interpolation in config
- [x] 🧩 Dynamic metadata columns
- [x] 🎯 Vector similarity search
- [x] 🗑️ Visual-range delete
- [x] 📋 Yank (ID / metadata / vector)
- [x] ⚙️ Provider-aware connection form
- [ ] 🟪 Weaviate adapter
- [ ] 🔍 Pinecone metadata filter in the record-list filter bar
- [ ] 🧭 Chroma multi-tenant / multi-database browser
- [ ] 📦 Prebuilt binaries + distribution (npm, Homebrew)
- [ ] 🔁 Reconnect on transient network errors
- [ ] 📈 JSON / CSV export of filtered records

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit
message conventions, testing requirements, and how to submit a pull request.
