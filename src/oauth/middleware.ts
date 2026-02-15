import type { OAuthEnv } from "../types";
import type { McpAuthContext } from "agents/mcp";

export interface TokenVerificationResult {
  authContext: McpAuthContext | null;
  response?: Response;
}

export async function verifyMcpToken(
  request: Request,
  env: OAuthEnv,
): Promise<TokenVerificationResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return {
      authContext: null,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Unauthorized: Missing Authorization header",
          },
          id: null,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      authContext: null,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Unauthorized: Invalid Authorization header format",
          },
          id: null,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  const token = authHeader.substring(7);

  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token)) {
    return {
      authContext: null,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Unauthorized: Invalid token format",
          },
          id: null,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  const tokenDataJson = await env.OAUTH_KV.get(`oauth:token:${token}`);

  if (!tokenDataJson) {
    return {
      authContext: null,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Unauthorized: Token not found or expired",
          },
          id: null,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  let tokenData: {
    clientId: string;
    userId: string;
    scopes?: string;
    email?: string;
    name?: string;
  };

  try {
    tokenData = JSON.parse(tokenDataJson);
  } catch {
    return {
      authContext: null,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error: Invalid token data",
          },
          id: null,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  const authContext: McpAuthContext = {
    props: {
      userId: tokenData.userId,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      email: tokenData.email,
      name: tokenData.name,
    },
  };

  return { authContext, response: undefined };
}
