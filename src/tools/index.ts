import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SessionManager } from "../manager/session.js";

import { registerSessionTools } from "./session.js";
import { registerCustomScriptTools } from "./custom.js";

// Facade combining all managers
export class FridaFacade {
  session: SessionManager;

  constructor() {
    this.session = new SessionManager();
  }
}

export function registerAllTools(server: McpServer, facade: FridaFacade) {
  registerSessionTools(server, facade.session);
  registerCustomScriptTools(server, facade.session);
}
