import type { Env } from "./types";
import { createPublicHandler, SERVER_CONFIG } from "./mcp-server";
import { runWithContext, logger, formatError } from "./utils/logger";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
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
        const handler = createPublicHandler();
        const response = await handler.fetch(request, env, ctx);

        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          headers.set(key, value);
        }
        headers.set("X-Request-Id", requestId);

        logger.info("Request completed", {
          status: response.status,
          durationMs: Date.now() - startTime,
        });

        return new Response(response.body, { status: response.status, headers });
      } catch (error) {
        logger.error("Request failed", {
          error: formatError(error),
          durationMs: Date.now() - startTime,
        });

        return new Response(JSON.stringify({ error: "Internal Server Error", requestId }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    });
  },
};

export { SERVER_CONFIG };
