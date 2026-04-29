/**
 * agent-setup.ts — Interactive CLI wizard for configuring Agent MCP identity.
 *
 * Usage:
 *   bun run agent-setup                    # Interactive setup for multiple products
 *
 * Guides the user through:
 *   1. Scan for known AI products (Claude Desktop, Antigravity, TRAE SOLO, etc.)
 *   2. Select which products to configure
 *   3. Set display name per product
 *   4. Inject env vars (auto / manual / template modes)
 *   5. Write credentials to ~/.nerve/credentials.json
 *   6. Summary and exit
 */

import * as p from "@clack/prompts";
import { createHash, webcrypto } from "crypto";
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const crypto = webcrypto;

// ─── Credentials File Helpers ────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function writeCredentialsFile(agentId: string, token: string, keyId: string, issuedAt: string, expiresAt?: string): void {
  const credentialsDir = join(homedir(), '.nerve');
  const credentialsFile = join(credentialsDir, 'credentials.json');
  
  // Create directory if it doesn't exist
  if (!existsSync(credentialsDir)) {
    mkdirSync(credentialsDir, { recursive: true });
  }
  
  // Read existing credentials
  let credentials: any = {
    version: 1,
    default_agent_id: agentId,
    entries: {}
  };
  
  if (existsSync(credentialsFile)) {
    try {
      credentials = JSON.parse(readFileSync(credentialsFile, 'utf-8'));
    } catch (err) {
      console.error(`[agent-setup] Error reading credentials file: ${err}`);
    }
  }
  
  // Update or add entry
  credentials.entries[agentId] = {
    token,
    key_id: keyId,
    issued_at: issuedAt,
    expires_at: expiresAt
  };
  
  // Set default agent id if not set
  if (!credentials.default_agent_id) {
    credentials.default_agent_id = agentId;
  }
  
  // Write back to file
  writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2) + '\n', 'utf-8');
  
  // Set file permissions to 600
  try {
    chmodSync(credentialsFile, 0o600);
  } catch (err) {
    console.error(`[agent-setup] Error setting file permissions: ${err}`);
  }
  
  p.note(
    `  写入凭证文件：${credentialsFile.replace(homedir(), "~")}\n  权限已设置为 600`,
    "✓ 凭证文件"
  );
}

// ─── Token Generation ────────────────────────────────────────────────────────

async function revokeAllTokens(agentId: string): Promise<void> {
  try {
    // List existing credentials
    const listRes = await fetch(`http://localhost:3141/api/agents/${agentId}/credentials`);
    if (!listRes.ok) return; // agent may not exist yet
    const creds = await listRes.json() as Array<{ kid: string; revoked_at: string | null }>;
    const activeCreds = creds.filter(c => !c.revoked_at);
    for (const cred of activeCreds) {
      await fetch(`http://localhost:3141/api/agents/${agentId}/credentials/${cred.kid}`, { method: 'DELETE' });
    }
  } catch {
    // best-effort
  }
}

async function registerAgentIfNeeded(agentId: string, displayName: string): Promise<void> {
  try {
    const checkRes = await fetch(`http://localhost:3141/api/agents/${agentId}`);
    if (checkRes.ok) return;
  } catch {}
  // Auto-register
  await fetch('http://localhost:3141/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: agentId,
      name: displayName,
      type: 'manual',
    }),
  });
}

async function issueTokenFromServer(agentId: string): Promise<{ token: string; keyId: string; issuedAt: string; expiresAt?: string }> {
  // Revoke old tokens first (rotation mode)
  await revokeAllTokens(agentId);

  const response = await fetch('http://localhost:3141/api/agents/' + agentId + '/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Failed to issue token: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return {
    token: result.token,
    keyId: result.kid,
    issuedAt: result.issued_at,
    expiresAt: result.expires_at
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

type InjectMode = "auto" | "manual";

interface ProductDef {
  id: string;
  label: string;
  defaultName: string;
  configPaths: string[];        // first existing path = detected as installed
  mcpServerKey: string | null;  // key in mcpServers JSON
  injectMode: InjectMode;
  manualInstructions?: string;  // for manual mode
}

interface ProductSelection {
  product: ProductDef;
  detected: boolean;
  configPath: string | null;    // resolved config file path (auto only)
  displayName: string;
}

// ─── Known Products Table ───────────────────────────────────────────────────

const KNOWN_PRODUCTS: ProductDef[] = [
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    defaultName: "claude-desktop",
    configPaths: [
      join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json"),
    ],
    mcpServerKey: "nerve-hub",
    injectMode: "auto",
  },
  {
    id: "google-antigravity",
    label: "Google Antigravity",
    defaultName: "google-antigravity",
    configPaths: [
      join(homedir(), ".gemini", "settings.json"),
    ],
    mcpServerKey: "nerve-hub",
    injectMode: "auto",
  },
  {
    id: "trae-solo",
    label: "TRAE SOLO",
    defaultName: "trae-solo",
    configPaths: [
      join(homedir(), ".trae-cn", "mcps"),
    ],
    mcpServerKey: null,
    injectMode: "manual",
    manualInstructions:
      "TRAE 的 MCP 配置由软件管理，请在 TRAE 设置 → MCP 中找到 nerve-hub 配置，手动添加以上变量。",
  },
  {
    id: "cursor",
    label: "Cursor",
    defaultName: "cursor",
    configPaths: [
      join(homedir(), ".cursor", "mcp.json"),
    ],
    mcpServerKey: "nerve-hub",
    injectMode: "auto",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectProduct(product: ProductDef): { detected: boolean; configPath: string | null } {
  for (const rawPath of product.configPaths) {
    try {
      if (existsSync(rawPath)) {
        const st = statSync(rawPath);
        if (product.injectMode === "auto" && st.isFile()) {
          return { detected: true, configPath: rawPath };
        }
        if (product.injectMode === "manual" && st.isDirectory()) {
          return { detected: true, configPath: rawPath };
        }
      }
    } catch {
      // path doesn't exist or inaccessible — try next
    }
  }
  return { detected: false, configPath: null };
}

function readJSON(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function writeJSON(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Check if a config file already has NERVE_HUB_AGENT_NAME injected for the given serverKey */
function hasExistingAgent(configPath: string, serverKey: string): boolean {
  try {
    const cfg = readJSON(configPath);
    return !!(cfg.mcpServers?.[serverKey]?.env?.NERVE_HUB_AGENT_NAME);
  } catch {
    return false;
  }
}

// ─── Main Flow ──────────────────────────────────────────────────────────────

async function main() {
  p.intro("nerve-hub agent setup");
  await interactiveSetup();
}

async function interactiveSetup() {
  // ── Step 1: Scan + multi-select ────────────────────────────────────────

  const scanResults = KNOWN_PRODUCTS.map((product) => {
    const { detected, configPath } = detectProduct(product);
    return { product, detected, configPath };
  });

  const s1Options: Array<{ value: number; label: string; hint?: string }> = [
    ...scanResults.map((r, i) => {
      const marker = r.detected ? "✓" : " ";
      const pathInfo = r.configPath
        ? r.configPath.replace(homedir(), "~")
        : "未检测到安装路径";
      const hint = r.product.injectMode === "manual" && r.detected
        ? "检测到安装，需手动配置"
        : r.product.injectMode === "manual"
        ? "需手动配置"
        : undefined;
      return {
        value: i,
        label: `[${marker}] ${r.product.label}  ${pathInfo}`,
        hint,
      };
    }),
    {
      // "Other product" option — always last
      value: KNOWN_PRODUCTS.length,
      label: "[ ] 其他产品  获取 MCP 配置模板，自行安装",
    },
  ];

  const selected = await p.multiselect({
    message: "检测到已安装的产品（空格选择/取消，回车确认）：",
    options: s1Options,
    initialValues: scanResults
      .map((r, i) => (r.detected && r.product.injectMode === "auto" ? i : -1))
      .filter((i) => i >= 0),
    required: false,
  });

  if (p.isCancel(selected) || selected.length === 0) {
    p.cancel("未选择任何产品，已取消。");
    process.exit(0);
  }

  const selectedIndices = selected as number[];

  // ── Step 2: Display name per selected product ───────────────────────────

  const selections: ProductSelection[] = [];

  for (const idx of selectedIndices) {
    if (idx === KNOWN_PRODUCTS.length) {
      // "Other product"
      const name = await p.text({
        message: "自定义 Agent 显示名称（默认: my-agent）：",
        placeholder: "my-agent",
        defaultValue: "my-agent",
      });
      if (p.isCancel(name)) {
        p.cancel("已取消。");
        process.exit(0);
      }
      selections.push({
        product: {
          id: "custom",
          label: "其他产品",
          defaultName: name as string,
          configPaths: [],
          mcpServerKey: null,
          injectMode: "manual",
        },
        detected: false,
        configPath: null,
        displayName: (name as string) || "my-agent",
      });
    } else {
      const info = scanResults[idx];
      const existingInfo = info.detected && info.configPath && info.product.mcpServerKey
        ? hasExistingAgent(info.configPath, info.product.mcpServerKey)
        : false;

      if (existingInfo) {
        const overwrite = await p.confirm({
          message: `${info.product.label} 已有 UID 配置，是否覆盖？`,
        });
        if (p.isCancel(overwrite)) {
          p.cancel("已取消。");
          process.exit(0);
        }
        if (!overwrite) {
          continue; // skip this product
        }
      }

      const name = await p.text({
        message: `${info.product.label} 的 Agent 显示名称（默认: ${info.product.defaultName}）：`,
        placeholder: info.product.defaultName,
        defaultValue: info.product.defaultName,
      });
      if (p.isCancel(name)) {
        p.cancel("已取消。");
        process.exit(0);
      }

      selections.push({
        product: info.product,
        detected: info.detected,
        configPath: info.configPath,
        displayName: (name as string) || info.product.defaultName,
      });
    }
  }

  if (selections.length === 0) {
    p.cancel("没有产品需要配置，已取消。");
    process.exit(0);
  }

  // ── Step 2.5: Server Address ──────────────────────────────────────────────

  const serverAddressPrompt = await p.text({
    message: "nerve-hub 地址 (本机留空，远端填 http://192.168.x.x:3141)：",
    placeholder: "",
    defaultValue: "",
  });
  if (p.isCancel(serverAddressPrompt)) {
    p.cancel("已取消。");
    process.exit(0);
  }
  const serverAddress = (serverAddressPrompt as string).trim();

  // ── Step 3: Per-product token issuance and injection ──────────────────────

  const autoDone: string[] = [];
  const manualDone: string[] = [];
  const templateDone: string[] = [];

  for (const sel of selections) {
    const agentId = sel.displayName;

    // Auto-register if agent doesn't exist yet
    await registerAgentIfNeeded(agentId, sel.displayName);

    // Issue per-agent token (revokes old tokens first)
    let tokenInfo;
    try {
      tokenInfo = await issueTokenFromServer(agentId);
    } catch (error) {
      p.note(`Failed to issue token for ${agentId}: ${error}`, `✗ ${sel.product.label}`);
      continue;
    }

    // Write credentials for this agent
    writeCredentialsFile(agentId, tokenInfo.token, tokenInfo.keyId, tokenInfo.issuedAt, tokenInfo.expiresAt);

    // Inject into config
    if (sel.product.id === "custom") {
      await showOtherProductTemplateWithToken(sel, serverAddress, tokenInfo.token);
      templateDone.push(sel.displayName);
    } else if (sel.product.injectMode === "auto" && sel.configPath) {
      injectAutoWithToken(sel, tokenInfo.token);
      autoDone.push(sel.product.label);
    } else if (sel.product.injectMode === "manual") {
      await showManualInstructionsWithToken(sel, serverAddress, tokenInfo.token);
      manualDone.push(sel.product.label);
    }
  }

  // ── Step 5: Summary ─────────────────────────────────────────────────────

  let summary = "";
  if (autoDone.length > 0) summary += `  自动注入：${autoDone.join(", ")}\n`;
  if (manualDone.length > 0) {
    const labels = manualDone.filter((l) => l !== "其他产品");
    if (labels.length > 0) summary += `  手动配置：${labels.join(", ")}（已获得配置说明）\n`;
  }
  if (templateDone.length > 0) summary += `  模板获取：${templateDone.join(", ")}\n`;
  summary += `\n  请重启已配置的产品以使配置生效。`;

  p.outro(summary);
  process.exit(0);
}

// ─── Injection helpers ──────────────────────────────────────────────────────

function injectAuto(sel: ProductSelection, serverAddress: string): void {
  const cfg = readJSON(sel.configPath!);
  if (!cfg.mcpServers) cfg.mcpServers = {};
  
  if (serverAddress) {
    let urlStr = serverAddress;
    if (!urlStr.endsWith("/mcp/sse")) {
      urlStr = urlStr.replace(/\/$/, "") + "/api/mcp/sse";
    }
    const url = new URL(urlStr);
    url.searchParams.set("agentName", sel.displayName);

    cfg.mcpServers[sel.product.mcpServerKey!] = {
      transport: "sse",
      url: url.toString()
    };

    writeJSON(sel.configPath!, cfg);

    p.note(
      `  注入 transport=sse\n  注入 url=${url.toString()}\n  配置文件已更新：${sel.configPath!.replace(homedir(), "~")}`,
      `✓ ${sel.product.label}`
    );
  } else {
    cfg.mcpServers[sel.product.mcpServerKey!] = {
      command: DEFAULT_BIN_PATH,
      args: ["mcp"],
      env: {
        NERVE_DB_PATH: DEFAULT_DB_PATH,
        NERVE_HUB_AGENT_NAME: sel.displayName,
      }
    };

    writeJSON(sel.configPath!, cfg);

    p.note(
      `  注入 command=${DEFAULT_BIN_PATH}\n  注入 args=["mcp"]\n  注入 NERVE_DB_PATH=${DEFAULT_DB_PATH}\n  注入 NERVE_HUB_AGENT_NAME=${sel.displayName}\n  配置文件已更新：${sel.configPath!.replace(homedir(), "~")}`,
      `✓ ${sel.product.label}`
    );
  }
}

function injectAutoWithToken(sel: ProductSelection, token: string): void {
  const cfg = readJSON(sel.configPath!);
  if (!cfg.mcpServers) cfg.mcpServers = {};
  
  cfg.mcpServers[sel.product.mcpServerKey!] = {
    command: DEFAULT_BIN_PATH,
    args: ["mcp"],
    env: {
      NERVE_DB_PATH: DEFAULT_DB_PATH,
      NERVE_HUB_AGENT_NAME: sel.displayName,
      NERVE_HUB_TOKEN: token,
    }
  };
  
  writeJSON(sel.configPath!, cfg);

  p.note(
    `  注入 command=${DEFAULT_BIN_PATH}\n  注入 args=["mcp"]\n  注入 NERVE_DB_PATH=${DEFAULT_DB_PATH}\n  注入 NERVE_HUB_AGENT_NAME=${sel.displayName}\n  注入 NERVE_HUB_TOKEN=<token>\n  配置文件已更新：${sel.configPath!.replace(homedir(), "~")}`,
    `✓ ${sel.product.label}`
  );
}

const DEFAULT_DB_PATH = join(homedir(), ".nerve", "hub.db");
const DEFAULT_BIN_PATH = join(homedir(), ".nerve-hub", "nerve-hub");

function buildMCPConfigJSON(sel: ProductSelection, command: string, args: string[], serverAddress: string, token?: string): string {
  if (serverAddress) {
    let urlStr = serverAddress;
    if (!urlStr.endsWith("/mcp/sse")) {
      urlStr = urlStr.replace(/\/$/, "") + "/api/mcp/sse";
    }
    const url = new URL(urlStr);
    url.searchParams.set("agentName", sel.displayName);

    return JSON.stringify(
      {
        mcpServers: {
          "nerve-hub": {
            transport: "sse",
            url: url.toString()
          },
        },
      },
      null,
      2
    );
  }

  const env: any = {
    NERVE_DB_PATH: DEFAULT_DB_PATH,
    NERVE_HUB_AGENT_NAME: sel.displayName,
  };
  
  if (token) {
    env.NERVE_HUB_TOKEN = token;
  }

  return JSON.stringify(
    {
      mcpServers: {
        "nerve-hub": {
          command,
          args,
          env,
        },
      },
    },
    null,
    2
  );
}

async function showManualInstructions(sel: ProductSelection, serverAddress: string): Promise<void> {
  const json = buildMCPConfigJSON(sel, DEFAULT_BIN_PATH, ["mcp"], serverAddress);

  console.log(`\n${json}\n`);

  const instructions = 
    sel.product.manualInstructions ??
    "请在对应软件的 MCP 设置中添加以上变量。";

  await p.confirm({
    message: `${instructions} 完成后按回车继续`,
  });
}

async function showManualInstructionsWithToken(sel: ProductSelection, serverAddress: string, token: string): Promise<void> {
  const json = buildMCPConfigJSON(sel, DEFAULT_BIN_PATH, ["mcp"], serverAddress, token);

  console.log(`\n${json}\n`);

  const instructions = 
    sel.product.manualInstructions ??
    "请在对应软件的 MCP 设置中添加以上变量。";

  await p.confirm({
    message: `${instructions} 完成后按回车继续`,
  });
}

async function showOtherProductTemplate(sel: ProductSelection, serverAddress: string): Promise<void> {
  const json = buildMCPConfigJSON(sel, "/path/to/nerve-hub", ["mcp"], serverAddress);
  console.log(`\n${json}\n`);
  await p.confirm({ message: "请将以上配置复制到对应产品的 MCP 设置中。完成后按回车继续" });
}

async function showOtherProductTemplateWithToken(sel: ProductSelection, serverAddress: string, token: string): Promise<void> {
  const json = buildMCPConfigJSON(sel, "/path/to/nerve-hub", ["mcp"], serverAddress, token);
  console.log(`\n${json}\n`);
  await p.confirm({ message: "请将以上配置复制到对应产品的 MCP 设置中。完成后按回车继续" });
}

main().catch((err) => {
  console.error("agent-setup:", err.message);
  process.exit(1);
});
