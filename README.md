# nerve-hub

AI Agent task bus — minimal state hub for multi-agent collaboration.

## Quick Start

```bash
bun install
bun test                    # Run smoke tests
bun run src/main.ts start   # REST API on :3141
bun run src/main.ts mcp     # MCP stdio server
```

## MCP Server Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nerve-hub": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/turing-hub/src/main.ts", "mcp"]
    }
  }
}
```

Replace `/absolute/path/to/turing-hub` with your actual project path.

Then restart Claude Desktop. A hammer icon 🔨 will appear in the bottom-right of the input box — click it to verify the 5 tools are loaded.

### 悟空钉钉 / Other MCP Clients

- **Command**: `bun`
- **Args**: `run /absolute/path/to/turing-hub/src/main.ts mcp`
- **CWD** (if required): `/absolute/path/to/turing-hub`

### Debug with MCP Inspector

```bash
npx @modelcontextprotocol/inspector bun run src/main.ts mcp
```

Open the printed URL in your browser to interactively test all tools.

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Create a task |
| GET | `/tasks` | List tasks (`?status=pending\|done\|failed`) |
| GET | `/tasks/:id` | Get a task |
| PATCH | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/health` | Health check |

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task (title, description?) |
| `list_tasks` | List tasks (status?: pending/done/failed) |
| `get_task` | Get a task by ID |
| `update_task` | Update task fields (status, result, etc.) |
| `delete_task` | Delete a task |

## Troubleshooting

**MCP connection fails ("connection closed: initialize response")**

1. Verify `bun` is installed: `bun --version`
2. Run manually to check for errors: `bun run src/main.ts mcp` (should hang waiting for stdin)
3. Use MCP Inspector to debug interactively
4. Check client logs:
   - Claude Desktop: `~/Library/Logs/Claude/mcp*.log`
