/**
 * MCP JSON snippets aligned with scripts/agent-setup.ts (`buildMCPConfigJSON` / `injectAutoWithToken`).
 */

export function buildRemoteSseConfig(agentName: string, serverBaseUrl: string): Record<string, unknown> {
  let urlStr = serverBaseUrl.trim();
  if (!urlStr.endsWith('/mcp/sse')) {
    urlStr = urlStr.replace(/\/$/, '') + '/api/mcp/sse';
  }
  const url = new URL(urlStr);
  url.searchParams.set('agentName', agentName);
  return {
    mcpServers: {
      'nerve-hub': {
        transport: 'sse',
        url: url.toString(),
      },
    },
  };
}

export function buildLocalStdioConfig(
  agentId: string,
  token: string,
  command: string,
  dbPath: string,
  args: string[] = ['mcp'],
): Record<string, unknown> {
  return {
    mcpServers: {
      'nerve-hub': {
        command,
        args,
        env: {
          NERVE_DB_PATH: dbPath,
          NERVE_HUB_AGENT_NAME: agentId,
          NERVE_HUB_TOKEN: token,
        },
      },
    },
  };
}

export function stringifyMcpConfig(cfg: Record<string, unknown>): string {
  return `${JSON.stringify(cfg, null, 2)}\n`;
}
