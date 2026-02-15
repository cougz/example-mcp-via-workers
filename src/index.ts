import type { Env } from "./types";
import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runWithContext, logger, formatError } from "./utils/logger";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function getCorsHeaders(env: Env): HeadersInit {
  const origin = env.CORS_ORIGIN ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "MCP Server Template",
    version: "1.0.0",
  });

  server.tool(
    "generate_uuid",
    "Generate random v4 UUID(s). count: 1-100 (default: 1)",
    { count: z.number().int().min(1).max(100).optional() },
    async ({ count = 1 }) => {
      const startTime = Date.now();
      logger.info("Tool invoked", { tool: "generate_uuid", params: { count } });

      try {
        const uuids: string[] = [];
        for (let i = 0; i < count; i++) {
          uuids.push(crypto.randomUUID());
        }

        logger.info("Tool completed", {
          tool: "generate_uuid",
          result: { count: uuids.length },
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, data: { uuids, count } }),
            },
          ],
        };
      } catch (error) {
        logger.error("Tool failed", {
          tool: "generate_uuid",
          error: formatError(error),
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...SECURITY_HEADERS },
      });
    }

    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const requestContext = {
      requestId,
      method: request.method,
      path: url.pathname,
    };

    return runWithContext(requestContext, async () => {
      const startTime = Date.now();
      logger.info("Request started");

      try {
        if (url.pathname === "/health" && request.method === "GET") {
          logger.info("Health check");
          return new Response(
            JSON.stringify({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() }),
            {
              status: 200,
              headers: { ...corsHeaders, ...SECURITY_HEADERS, "Content-Type": "application/json" },
            },
          );
        }

        if (url.pathname === "/mcp" || url.pathname === "/") {
          const server = createMcpServer();
          const handler = createMcpHandler(server);
          const response = await handler(request, env, ctx);

          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries({ ...corsHeaders, ...SECURITY_HEADERS })) {
            headers.set(key, value);
          }
          headers.set("X-Request-Id", requestId);

          logger.info("MCP request completed", {
            status: response.status,
            durationMs: Date.now() - startTime,
          });

          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }

        logger.warn("Route not found", { path: url.pathname });
        return new Response("Not found", {
          status: 404,
          headers: { ...corsHeaders, ...SECURITY_HEADERS, "Content-Type": "text/plain" },
        });
      } catch (error) {
        logger.error("Request failed", {
          error: formatError(error),
          durationMs: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: "Internal Server Error", requestId }),
          {
            status: 500,
            headers: { ...corsHeaders, ...SECURITY_HEADERS, "Content-Type": "application/json" },
          },
        );
      }
    });
  },
};
