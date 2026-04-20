# Nerve Hub

> AI Agent state bus -- the nervous system for multi-agent collaboration.

Nerve Hub provides a centralized state management layer for AI agents. It exposes both a REST API and an MCP (Model Context Protocol) server, enabling Claude Desktop and other MCP-compatible clients to manage tasks, projects, and state transitions.

## Installation

```bash
cd hub
pnpm install
pnpm build
```

## Quick Start

```bash
# Initialize a project (creates .nerve/ directory)
nerve-hub init my-project

# Start the HTTP server (default port 3141)
nerve-hub start

# Open Web UI in browser
open http://localhost:3141

# Or start in MCP stdio mode (for Claude Desktop)
nerve-hub mcp
```

## Development

```bash
pnpm dev          # Watch mode with tsx (backend)
pnpm build        # Build backend with tsup
pnpm test         # Run tests with vitest

# Web UI development (frontend)
cd web
npm install
npm run dev       # Start Vite dev server (proxies API to localhost:3141)
npm run build     # Build for production
```

## Claude Desktop Configuration

Add Nerve Hub as an MCP server in Claude Desktop:

```bash
claude mcp add nerve-hub -- node /path/to/hub/dist/cli/index.js mcp
```

Or manually in your Claude Desktop config:

```json
{
  "mcpServers": {
    "nerve-hub": {
      "command": "node",
      "args": ["/path/to/hub/dist/cli/index.js", "mcp"]
    }
  }
}
```

## REST API

### Projects

```bash
# Create a project
curl -X POST http://localhost:3141/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project", "description": "A test project"}'

# List projects
curl http://localhost:3141/api/v1/projects

# Get project
curl http://localhost:3141/api/v1/projects/{id}

# Get project board (tasks grouped by status)
curl http://localhost:3141/api/v1/projects/{id}/board
```

### Tasks

```bash
# Create a task
curl -X POST http://localhost:3141/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-Nerve-Agent: claude" \
  -d '{
    "projectId": "{project-id}",
    "title": "Implement auth module",
    "type": "code",
    "priority": "high",
    "assignee": "claude"
  }'

# Query tasks
curl "http://localhost:3141/api/v1/tasks?projectId={id}&status=running"

# Get a task
curl http://localhost:3141/api/v1/tasks/{id}

# Update a task
curl -X PATCH http://localhost:3141/api/v1/tasks/{id} \
  -H "Content-Type: application/json" \
  -H "X-Nerve-Agent: claude" \
  -d '{"status": "done", "progress": 100}'

# Delete a task
curl -X DELETE http://localhost:3141/api/v1/tasks/{id}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task in a project |
| `update_task` | Update an existing task (status, progress, result, etc.) |
| `query_tasks` | Query tasks with filters (projectId, status, assignee, type) |
| `get_task` | Get a single task by ID |
| `get_project_context` | Get project info and task summary |

## MCP Resources

| Resource URI | Description |
|-------------|-------------|
| `taskboard://{projectId}` | Project board view (tasks grouped by status) |
| `tasks://{agentId}` | Tasks assigned to a specific agent |

## Architecture

- **Core**: SQLite-backed storage with Zod validation, automatic state logging
- **API**: Fastify HTTP server with JSON endpoints
- **Web UI**: React + TypeScript SPA (Vite) with Kanban board, event log, and task topology
- **MCP**: Model Context Protocol server for Claude Desktop integration
- **CLI**: Commander-based CLI for init, start, and mcp commands

## MuleRun Integration

Nerve Hub can serve as the state bus for MuleRun agent orchestration. Agents communicate through the REST API or MCP interface, with all state transitions automatically logged for audit and debugging.

## License

MIT
