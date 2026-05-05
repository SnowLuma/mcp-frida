import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SessionManager } from "../manager/session.js";
import { fmt } from "./utils.js";

export function registerCustomScriptTools(server: McpServer, mgr: SessionManager) {
  server.registerTool(
    "load_script",
    {
      title: "Load Persistent Script",
      description:
        "Load a persistent background Frida script. Use this to set up hooks that collect data over time or long-running RPC exports. Afterwards, use `call_rpc` to invoke functions or `get_script_output` to check logs. If this fails because the process is detached/crashed, call the `attach` tool again and retry.",
      inputSchema: z.object({
        name: z.string().describe("Unique identifier for this script (e.g. 'my_hooks')"),
        source: z
          .string()
          .describe("Frida JS code. Use `send(data)` to emit logs, or `rpc.exports = { ... }` block for RPC."),
      }),
    },
    async ({ name, source }) => {
      try {
        await mgr.loadPersistentScript(name, source);
        // After briefly loading, check if there's any immediate output
        const initialOutput = mgr.getScriptOutput(name);
        return {
          content: [
            {
              type: "text",
              text:
                initialOutput.length > 0
                  ? `Script '${name}' loaded. Initial output:\n${JSON.stringify(initialOutput, null, 2)}`
                  : `Script '${name}' loaded successfully. Use get_script_output to check for logs later.`,
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed to load script: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_script_output",
    {
      title: "Get Script Output",
      description:
        "Retrieve accumulated messages (`send(data)`) from a persistently loaded script and clear its message queue. Similar to tailing a log.",
      inputSchema: z.object({
        name: z.string().describe("Name of the running persistent script"),
      }),
    },
    async ({ name }) => {
      try {
        const out = mgr.getScriptOutput(name);
        if (out.length === 0) {
          return { content: [{ type: "text", text: `(No new messages from script '${name}')` }] };
        }
        return { content: [{ type: "text", text: fmt({ messages: out }) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    "call_rpc",
    {
      title: "Call RPC Method",
      description:
        "Call a function exported by a persistent script loaded via `load_script`. If this fails because the process is detached/crashed, call the `attach` tool again and then `load_script` before retrying.",
      inputSchema: z.object({
        script: z.string().describe("Name of the persistent script"),
        method: z.string().describe("RPC method name"),
        args: z.array(z.unknown()).optional().describe("JSON arguments to pass"),
      }),
    },
    async ({ script, method, args }) => {
      try {
        const result = await mgr.rpcCall(script, method, args ?? []);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `RPC error: ${e.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    "unload_script",
    {
      title: "Unload Persistent Script",
      description: "Securely unload and clean up a persistent script.",
      inputSchema: z.object({
        name: z.string().describe("Name of the script to unload"),
      }),
    },
    async ({ name }) => {
      try {
        await mgr.unloadPersistentScript(name);
        return { content: [{ type: "text", text: `Script '${name}' unloaded.` }] };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed to unload script: ${e.message}` }],
          isError: true,
        };
      }
    },
  );
}
