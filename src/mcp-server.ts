import type { Env } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { registerTools } from "./tools";
import { logger } from "./utils/logger";

export const SERVER_CONFIG = {
  name: "MCP Server Template",
  version: "1.0.0",
} as const;

export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_CONFIG);
  registerTools(server);
  logger.debug("MCP server created");
  return server;
}

export function createPublicHandler() {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const server = createMcpServer();
      const handler = createMcpHandler(server, { route: "/mcp" });
      return handler(request, env, ctx);
    },
  };
}
