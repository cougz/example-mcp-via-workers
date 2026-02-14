import type { Env, McpServerConfig } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { log, logRequest, logError } from "./utils/logger";
import { registerTools, tools } from "./tools";
import { registerResources, resources } from "./resources";
import { registerPrompts, prompts } from "./prompts";

const SERVER_CONFIG: McpServerConfig = {
  name: "MCP Server Template",
  version: "1.0.0",
};

function createServer(request: Request, env: Env, ctx: ExecutionContext): McpServer {
  const server = new McpServer({
    name: SERVER_CONFIG.name,
    version: SERVER_CONFIG.version,
  });

  const toolContext = { env, ctx, request };

  registerTools(server, toolContext);
  registerResources(server);
  registerPrompts(server);

  log("info", "Server initialized", {
    serverName: SERVER_CONFIG.name,
    version: SERVER_CONFIG.version,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    promptsCount: prompts.length,
  });

  return server;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function handleError(error: unknown): Response {
  logError(error, "Request handler error");
  return new Response(JSON.stringify({ error: "Internal Server Error" }), {
    status: 500,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    logRequest(request);

    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    try {
      const server = createServer(request, env, ctx);
      const handler = createMcpHandler(server);
      const response = await handler(request, env, ctx);

      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        newHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      return handleError(error);
    }
  },
};

export { SERVER_CONFIG, tools, resources, prompts };
