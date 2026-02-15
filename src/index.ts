import type { Env, McpServerConfig } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { log, CORS_HEADERS, OPTIONS_RESPONSE, ERROR_RESPONSE_BODY } from "./utils/logger";
import { registerTools } from "./tools";

const SERVER_CONFIG: McpServerConfig = Object.freeze({
  name: "MCP Server Template",
  version: "1.0.0",
});

function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_CONFIG);
  registerTools(server);
  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return OPTIONS_RESPONSE;
    }

    try {
      const server = createMcpServer();
      const handler = createMcpHandler(server);
      const response = await handler(request, env, ctx);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      log("error", "Request failed", { error: error instanceof Error ? error.message : String(error) });
      return new Response(ERROR_RESPONSE_BODY, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};

export { SERVER_CONFIG };
