import type { Env } from "./types";
import { MCPServer } from "./mcp-agent";
import { routeAgentRequest, getAgentByName } from "agents";
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

        if (url.pathname === "/mcp") {
          logger.info("Backwards compatibility - forwarding /mcp to agent route");
          const agent = await getAgentByName(env.MCPServer as any, "default");
          if (!agent) {
            return new Response("Agent not found", {
              status: 500,
              headers: { ...corsHeaders, ...SECURITY_HEADERS },
            });
          }
          const mcpUrl = new URL(request.url);
          mcpUrl.pathname = "/agents/mcp-server/default/mcp";
          const mcpRequest = new Request(mcpUrl.toString(), request);
          const response = await agent.fetch(mcpRequest);

          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries({ ...corsHeaders, ...SECURITY_HEADERS })) {
            headers.set(key, value);
          }
          headers.set("X-Request-Id", requestId);

          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }

        const agentResponse = await routeAgentRequest(request, env);

        if (agentResponse) {
          const headers = new Headers(agentResponse.headers);
          for (const [key, value] of Object.entries({ ...corsHeaders, ...SECURITY_HEADERS })) {
            headers.set(key, value);
          }
          headers.set("X-Request-Id", requestId);

          logger.info("Agent request completed", {
            status: agentResponse.status,
            durationMs: Date.now() - startTime,
          });

          return new Response(agentResponse.body, {
            status: agentResponse.status,
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

export { MCPServer };
