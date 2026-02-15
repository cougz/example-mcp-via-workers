import type { Env } from "./types";
import { createPublicHandler, SERVER_CONFIG } from "./mcp-server";
import { CORS_HEADERS, OPTIONS_RESPONSE, ERROR_RESPONSE_BODY, log } from "./utils/logger";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return OPTIONS_RESPONSE;
    }

    try {
      const { isOAuthConfigured, createOAuthProvider } = await import("./oauth");

      if (isOAuthConfigured(env)) {
        const provider = createOAuthProvider(env);
        return provider.fetch(request, env, ctx);
      }

      const handler = createPublicHandler();
      const response = await handler.fetch(request, env, ctx);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      log("error", "Request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response(ERROR_RESPONSE_BODY, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};

export { SERVER_CONFIG };
