import type { Env, OAuthEnv } from "../types";
import { createPublicHandler } from "../mcp-server";
import { handleOAuthRequest } from "./access-handler";
import { log } from "../utils/logger";

export function createOAuthProvider(env: OAuthEnv) {
  const mcpHandler = createPublicHandler();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiHandler: any = {
    async fetch(request: Request, envObj: any, ctx: ExecutionContext) {
      const response = await mcpHandler.fetch(request, envObj, ctx);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oauthHandler: any = {
    async fetch(request: Request, envObj: any, ctx: ExecutionContext) {
      return handleOAuthRequest(request, env as OAuthEnv, ctx);
    },
  };

  return {
    fetch(request: Request, env: any, ctx: ExecutionContext) {
      const url = new URL(request.url);

      if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
        return apiHandler.fetch(request, env, ctx);
      }

      return oauthHandler.fetch(request, env, ctx);
    },
  };
}

export function isOAuthConfigured(env: unknown): env is OAuthEnv {
  const e = env as OAuthEnv;
  const configured = !!(
    e.ACCESS_TEAM_NAME &&
    e.ACCESS_CLIENT_ID &&
    e.ACCESS_CLIENT_SECRET &&
    e.COOKIE_ENCRYPTION_KEY &&
    e.OAUTH_KV
  );

  const partial = !!(
    e.ACCESS_TEAM_NAME ||
    e.ACCESS_CLIENT_ID ||
    e.ACCESS_CLIENT_SECRET ||
    e.COOKIE_ENCRYPTION_KEY ||
    e.OAUTH_KV
  );

  if (partial && !configured) {
    const missing = [];
    if (!e.ACCESS_TEAM_NAME) missing.push("ACCESS_TEAM_NAME");
    if (!e.ACCESS_CLIENT_ID) missing.push("ACCESS_CLIENT_ID");
    if (!e.ACCESS_CLIENT_SECRET) missing.push("ACCESS_CLIENT_SECRET");
    if (!e.COOKIE_ENCRYPTION_KEY) missing.push("COOKIE_ENCRYPTION_KEY");
    if (!e.OAUTH_KV) missing.push("OAUTH_KV (KV namespace binding)");

    log(
      "warn",
      `OAuth partially configured - missing: ${missing.join(", ")}. Running in public mode.`,
    );
  }

  if (configured) {
    log("info", "OAuth configured - running in protected mode");
  }

  return configured;
}
