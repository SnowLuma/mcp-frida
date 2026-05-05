import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SessionManager } from "../manager/session.js";

export function registerSessionTools(server: McpServer, mgr: SessionManager) {
  server.registerTool(
    "attach",
    {
      title: "Attach to Process",
      description:
        "Attach Frida to a process. AI MUST call this first, and MUST call it again whenever any other tool reports that the process is detached or crashed.",
      inputSchema: z.object({
        target: z
          .union([z.number(), z.string()])
          .describe("Process ID (number) or Process Name (string, e.g. 'notepad.exe')."),
      }),
    },
    async ({ target }) => {
      try {
        await mgr.init(target);
        return {
          content: [
            {
              type: "text",
              text: `Successfully attached to ${target} (${mgr.status.processName}).`,
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed to attach: ${e.message}` }],
          isError: true,
        };
      }
    },
  );
}
