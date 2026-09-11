# smilexx-skill-mcp-manager

English | [简体中文](README.md)

A DSH plugin for managing **skills** and **MCP servers** right from the web UI and the terminal.

Refactored from [dsh-skill-mcp-panel](https://github.com/Fishquito7/dsh-skill-mcp-panel) v2.0.2 — keeping only the two tabs (Skills / MCP) under the official **Plugins** settings section. The plugin-management module (list / install / enable / disable / remove / duplicates / anomalies) was removed; use `dshmarket` or the `dsh plugin` CLI for that.

## Features

### Skills (Settings → Plugins → Skills)
- Filter by **category** (`metadata.category`) via dropdown instead of a workspace/group bar
- **Single-column list rows**: circle icon + skill name + one-line description + scope badge + enable switch per row; **click a row to open a details modal** (native DSH Modal: SKILL.md content, enable switch, delete/close)
- Enable/disable (rename to `SKILL.md.disabled`), delete, add (single file / bundle dir / zip / drag & drop)
- Batch migrate / groups (dialogs, kept from the base)

### MCP (Settings → Plugins → MCP)
- Manages the managed block in the profile's `cordis.patch.yml`; STDIO / HTTP transports
- **Single-column list rows**: circle icon + server name + summary (transport/status/tool count) + edit/test/delete + enable switch per row; **click a row to open a details modal** (status, config key-values, discovered tools, test/delete/edit/close)
- Add, edit, enable/disable, remove, test connection; hot-applied via DSH HMR after saving
- `env` / `headers` secrets are masked (keys only in the modal)

## Install

```bash
# First remove the plugin it replaces (avoid settings-slot id conflicts)
dsh plugin --profile web remove dsh-plugin-manager
# Install this package (tarball or local dir)
dsh plugin --profile web add <smilexx-skill-mcp-manager-0.4.1.tgz>
```

Restart the gateway (`dsh-restart`), then refresh the page.

## CLI

The package ships the unified `dsh-panel` command:

```bash
dsh-panel skill list                  # list skills (global / workspace)
dsh-panel skill enable|disable <name>
dsh-panel skill delete <name> [--yes]
dsh-panel skill add <path> [--project | --workspace <path>]
dsh-panel skill scope <name> [--global | --workspace <path>] [--copy]
dsh-panel skill migrate <name...> --from <ws> --to <ws> [--copy]
dsh-panel mcp list
dsh-panel mcp add|remove|enable|disable|test <name>
```

## Development

Source is TypeScript under `src/`; compiled `lib/*.js` is committed with the repo. After editing run `pnpm build`; before publishing run `node scripts/check.mjs` (version gate).

## Uninstall

```bash
dsh plugin --profile web remove smilexx-skill-mcp-manager
```

## License

MIT
