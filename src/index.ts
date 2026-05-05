import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FridaFacade, registerAllTools } from "./tools/index.js";

const mgr = new FridaFacade();

// Optional: pre-attach if PID given on command line (backward compat)
const pid = parseInt(process.argv[2], 10);
if (pid && !isNaN(pid)) {
  try {
    await mgr.session.init(pid);
    process.stderr.write(`[frida-mcp] Attached to pid ${pid} (${mgr.session.status.processName})\n`);
  } catch (e: any) {
    process.stderr.write(`[frida-mcp] Warning: failed to attach pid ${pid}: ${e.message}\n`);
    process.stderr.write(`[frida-mcp] Use \`attach\` tool to connect.\n`);
  }
} else {
  process.stderr.write(`[frida-mcp] No target PID. Use attach tool to connect.\n`);
}

const server = new McpServer({ name: "frida-mcp", version: "2.0.0" });
registerAllTools(server, mgr);

async function shutdown() {
  await mgr.session.dispose();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
