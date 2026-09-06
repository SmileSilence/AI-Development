# dsh-workspace-enhancer

DSH (DeepSeek Harness) right-side workspace enhancement plugin.

## Features

1. **Pin workspaces & sessions** — workspace `···` menu; session quick-pin button beside `···` + `···` menu
2. **Codex-style hover card** — workspace directory clickable to open in the system file manager
3. **Right-click = `···` menu** — workspace menu includes "Open Workspace"
4. **Blank-area right-click** — new workspace / new session
5. **Bulk archive sessions + bulk delete workspaces** (archive semantics: hidden from UI, data kept on disk)
6. **Default session mode selector** — permission-picker-style dropdown above the title bar, choosing the default agent preset for new sessions
7. **Workspace/session tags** — integrated dsh-workspace-tagger: tags, dual-color pills, row tinting, tag-management settings page (toggleable via `tags.enabled`)
8. **Tag dialog dropdown + running-tag enhancements** — the tag dialog is now a single dropdown (the running-tag is excluded and configured only on the settings page); collapsed workspaces show "running-tag-name ×N"; running sessions and workspaces with running sessions auto-pin to the top
9. **Tag filter (multi-condition AND)** — a funnel button on the right of the workspace title bar (wide sidebar only) opens a Feishu-style filter panel: multiple condition rows combined with AND, each row picks its own scope (all / workspaces / sessions) and condition (contains / not-contains / equals), multi-tag selection (single when equals), add / remove rows, clear all, and a live "N item(s) filtered" counter; the button highlights while a filter is active; the search input and action buttons stay in one tight group

## Install

```bash
# npm (after publish)
dsh plugin --profile web add dsh-workspace-enhancer

# offline tarball
dsh plugin --profile web add ./dsh-workspace-enhancer-0.4.0.tgz

# git (requires pnpm allowBuilds for the prepare script)
dsh plugin --profile web add github:user/dsh-workspace-enhancer#<sha>
```

Global install: append the patch row to `$DSH_HOME/cordis.patch.yml` (shared by all profiles).

## Uninstall

```bash
dsh plugin --profile <name> remove dsh-workspace-enhancer
```

Verify the four manifests (dependencies, dsh.profile.bundles, node_modules, patch layer) for leftovers.

## Development

```bash
npm install
npm run check   # typecheck + test + build + pack dry-run
```
