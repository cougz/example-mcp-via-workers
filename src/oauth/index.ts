import type { Env, OAuthEnv } from "../types";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createPublicHandler } from "../mcp-server";
import { createAuthHandler } from "./auth-handler";
import { log } from "../utils/logger";

export function createOAuthProvider(env: OAuthEnv): OAuthProvider {
  const mcpHandler = createPublicHandler();

  const authHandler = createAuthHandler();

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

  return new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler,
    defaultHandler: authHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
  });
}

export function isOAuthConfigured(env: unknown): env is OAuthEnv {
  const e = env as OAuthEnv;
  const configured = !!(
    e.ACCESS_CLIENT_ID &&
    e.ACCESS_CLIENT_SECRET &&
    e.ACCESS_TOKEN_URL &&
    e.ACCESS_AUTHORIZATION_URL &&
    e.ACCESS_JWKS_URL &&
    e.COOKIE_ENCRYPTION_KEY &&
    e.OAUTH_KV
  );

  const partial = !!(
    e.ACCESS_CLIENT_ID ||
    e.ACCESS_CLIENT_SECRET ||
    e.ACCESS_TOKEN_URL ||
    e.ACCESS_AUTHORIZATION_URL ||
    e.ACCESS_JWKS_URL ||
    e.COOKIE_ENCRYPTION_KEY ||
    e.OAUTH_KV
  );

  if (partial && !configured) {
    log(
      "warn",
      "OAuth partially configured - some secrets missing. Running in public mode.",
      {
        hasClientId: !!e.ACCESS_CLIENT_ID,
        hasClientSecret: !!e.ACCESS_CLIENT_SECRET,
        hasTokenUrl: !!e.ACCESS_TOKEN_URL,
        hasAuthUrl: !!e.ACCESS_AUTHORIZATION_URL,
        hasJwksUrl: !!e.ACCESS_JWKS_URL,
        hasCookieKey: !!e.COOKIE_ENCRYPTION_KEY,
        hasKv: !!e.OAUTH_KV,
      }
    );
  }

  if (configured) {
    log("info", "OAuth configured - running in protected mode");
  }

  return configured;
}
