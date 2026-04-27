# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick commands

```bash
bun run setup          # Install deps (arch-aware: handles amd64/arm64 shared dirs)
bun run dev            # Start API server (port 3141) + Vite dev server (port 5173)
bun test               # Run all tests (bun:test)
bun run release        # Tests → build frontend → compile MCP binary → print config
bun run start          # Start API + Runner + Inbox only (no frontend)
bun run mcp            # Start MCP stdio server (for Claude Desktop etc.)
bun run inspect        # Open MCP Inspector for debugging tools
```

**Database location**: `NERVE_DB_PATH` env var (default: `.nerve/hub.db`). The MCP binary and dev server share the same DB via this path.

## Architecture

nerve-hub is an AI Agent task bus — a local SQLite-backed service that lets heterogeneous AI agents (Claude Desktop, TRAE SOLO, Google Antigravity) collaborate through shared projects, tasks, handoffs, and an event log.

Three runtimes, one database:

| Component | File | Role |
|-----------|------|------|
| **API Server** | `src/api.ts` | `Bun.serve()` REST API + WebSocket broadcast on `:3141`. Auto-serves `web/dist/` for SPA routes, strips `/api` prefix. |
| **MCP Server** | `src/mcp.ts` | 23 MCP tools over stdio (JSON-RPC). Uses `@modelcontextprotocol/sdk`. Long responses (>800 chars) offload to `.nerve/cache/` files. |
| **Runner** | `src/runner.ts` | Background loop: dispatch pending tasks to webhook agents (15s), heartbeat timeout checks (30s). |

Supporting modules:

- **`src/db.ts`** — `TaskDB` class wrapping `bun:sqlite`. All state lives here: projects, tasks, events, comments, agents. Versioned migrations (currently v12) auto-apply on startup. Uses WAL mode + 10s busy timeout for concurrent access.
- **`src/main.ts`** — Entry point, CLI arg parser (`start` vs `mcp` modes), env var handling. Redirects stdout→stderr in MCP mode to avoid corrupting the JSON-RPC transport.
- **`src/inbox.ts`** — File-based task completion. Polls `.nerve/inbox/` every 5s for `*.done.json` files. Used by remote agents that can't reach localhost.

## Key design decisions

- **No dependencies beyond Bun + MCP SDK + Zod**. HTTP uses `Bun.serve()`, DB uses `bun:sqlite`. This keeps the MCP binary small and avoids native rebuilds.
- **`creator` field on tasks is read-only after creation**. The REST API strips it from PATCH requests silently.
- **Agent rules live in the DB** (agents table, `rules` column). AGENTS.md is a slim pointer that tells agents to call `get_agent_rules` / `get_project_rules` via MCP.
- **Two identities, one DB**: The compiled binary (`~/.nerve-hub/nerve-hub mcp`) used by Claude Desktop and the dev server (`bun run dev`) share the same database via `NERVE_DB_PATH`. This avoids "developing while using" confusion.
- **Inbox protocol**: Agents write `.nerve/inbox/<taskId>.done.json` → server picks it up → moves to `processed/` or `failed/`. File must be >1s old before reading (guards against partial writes).

## Frontend (web/)

React + TypeScript + Vite + TailwindCSS v4. Built separately (`npm` not bun — npm handles platform-native deps like esbuild/rollup). Key pages: `Kanban.tsx`, `TaskDetail.tsx`, `Agents.tsx`, `HandoffQueue.tsx`, `EventLog.tsx`, `ProjectList.tsx`. Uses `lucide-react` for icons.

## Multi-agent workflow

This repo is itself managed through nerve-hub. Agents follow the 6-step lifecycle in `.agent/rules/00-workflow.md`. The `.agent/` directory contains rules, specs, templates, and self-test reports — these are the project's internal coordination layer, not part of the application.

Agent participants: `claude-desktop` (orchestrator), `trae-solo` (primary implementor), `claude-code` (scaffolding/automation), `claude-web` (research/docs), `trae-ide` (interactive coding).

## Knowledge docs

Project knowledge docs live in `docs/` using index+small-file structure. **Never read the full files at root** (`SPARKS.md`, `EXP.md`) — they are redirect stubs.

| Doc type | Entry point | Usage |
|----------|------------|-------|
| Product SPARKS | `docs/sparks/INDEX.md` | Read index first, then specific `spark-NNN.md` |
| Workflow EXP | `docs/exp/INDEX.md` | Read index first, then specific `exp-NNN.md` |
| New ideas | `docs/sparks/INBOX.md` / `docs/exp/INBOX.md` | Append new entries |
| Execution reflections | `.agent/ascension/<agent-id>/reflections.md` | Runtime artifacts |
