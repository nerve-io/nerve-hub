import fs from "fs";
import path from "path";

export function initCommand(name?: string) {
  const projectName = name || "default";
  const nerveDir = path.join(process.cwd(), ".nerve");

  if (fs.existsSync(nerveDir)) {
    console.log(".nerve/ directory already exists.");
    return;
  }

  fs.mkdirSync(nerveDir, { recursive: true });

  // Create a .gitignore inside .nerve to ignore the db
  fs.writeFileSync(path.join(nerveDir, ".gitignore"), "*.db\n*.db-wal\n*.db-shm\n");

  console.log(`Initialized Nerve Hub project "${projectName}" in .nerve/`);
  console.log(`  Database: .nerve/hub.db`);
  console.log(`  Start server: nerve-hub start`);
  console.log(`  MCP mode: nerve-hub mcp`);
}
