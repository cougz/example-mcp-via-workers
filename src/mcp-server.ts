import type { McpServerConfig } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { registerTools } from "./tools";

export const SERVER_CONFIG: McpServerConfig = Object.freeze({
  name: "MCP Server Template",
  version: "1.0.0",
});

export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_CONFIG);
  registerTools(server);
  return server;
}

export function createPublicHandler() {
  return {
    async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
      const server = createMcpServer();
      const handler = createMcpHandler(server, { route: "/mcp" });
      return handler(request, env, ctx);
    },
  };
}
