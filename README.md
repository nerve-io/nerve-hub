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

## Design Notes

### 异构 Agent 系统的文件边界问题

成熟 Agent 系统（Claude Desktop、钉钉悟空等）都会严格限制自己在用户本地的文件系统边界（sandbox）。这导致异构 Agent 之间难以彼此投送、共享文件。

nerve-hub 的解法：**不共享文件，共享意图**。通过 SQLite 作为唯一的状态中枢，Agent 之间只交换结构化的任务描述（title、description、status、result），而非文件本身。每个 Agent 在自己的沙箱内独立工作，通过任务状态同步协作进度。

## Roadmap

- [ ] **跨 Agent 文件共享** — 成熟 Agent 系统严格限制本地文件系统边界，异构 Agent 之间难以投送、共享文件。需要设计一个安全的文件中转机制（如基于 SQLite blob 存储、或约定共享目录 + 签名验证），让 Agent A 产出的文件能被 Agent B 消费。

## Troubleshooting

1. Verify `bun` is installed: `bun --version`
2. Run manually to check for errors: `bun run src/main.ts mcp` (should hang waiting for stdin)
3. Use MCP Inspector to debug interactively
4. Check client logs:
   - Claude Desktop: `~/Library/Logs/Claude/mcp*.log`

**钉钉悟空 MCP 初始化错误**

悟空钉钉 MCP STDIO 模式下，**必须确保 MCP 入口文件在该会话可访问的目录下**。如果配置的路径不在悟空钉钉允许访问的目录范围内，将提示初始化错误。

解决方案：在悟空钉钉的 MCP 配置中，将项目目录添加到允许访问的路径列表。
