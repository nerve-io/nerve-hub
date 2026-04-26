import { spawn, spawnSync } from "bun";

const CLICKLICK = "/opt/homebrew/bin/cliclick";

export function wakeClaudeDesktop(message: string): void {
  // Copy message to clipboard synchronously
  spawnSync(["pbcopy"], { stdin: new TextEncoder().encode(message) });

  // Get Claude window bounds synchronously
  const bounds = spawnSync(["osascript", "-e",
    `tell application "System Events" to tell process "Claude"
       tell window 1
         set p to position
         set s to size
         return (item 1 of p) & "," & (item 2 of p) & "," & (item 1 of s) & "," & (item 2 of s)
       end tell
     end tell`]);

  // Activate Claude Desktop
  spawn(["osascript", "-e", 'tell application "Claude" to activate']);

  // Parse window bounds and compute input area click position
  const parts = bounds.stdout.toString().trim().split(",").map(Number);
  const wx = parts[0] ?? 0, wy = parts[1] ?? 0, ww = parts[2] ?? 800, wh = parts[3] ?? 600;
  const cx = Math.round(wx + ww / 2);        // horizontal center
  const cy = Math.round(wy + wh - 50);       // ~50px from bottom (input area)

  // Wait for Claude to activate, then: click input → paste → return
  // Single cliclick call with built-in waits to avoid spawn race conditions
  setTimeout(() => {
    spawn([CLICKLICK,
      `c:${cx},${cy}`,       // click input area to focus
      "w:400",                // wait 400ms
      "kd:cmd", "t:v", "ku:cmd", // Cmd+V paste
      "w:600",                // wait 600ms for paste to render
      "kp:enter",             // Enter to send
    ]);
  }, 800);
}
