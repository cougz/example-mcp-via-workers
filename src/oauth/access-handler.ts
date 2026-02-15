import type { OAuthEnv } from "../types";
import {
  bindStateToSession,
  createOAuthState,
  fetchUpstreamAuthToken,
  getUpstreamAuthorizeUrl,
  OAuthError,
  validateOAuthState,
} from "./utils";

interface AuthRequest {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  responseType: string;
}

type EnvWithOauth = OAuthEnv;

function buildAccessUrls(teamName: string, clientId: string) {
  const baseUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${clientId}`;
  return {
    tokenUrl: `${baseUrl}/token`,
    authorizationUrl: `${baseUrl}/authorization`,
    jwksUrl: `${baseUrl}/jwks`,
  };
}

export async function handleOAuthRequest(
  request: Request,
  env: EnvWithOauth,
  ctx: ExecutionContext,
) {
  const { pathname, searchParams } = new URL(request.url);

  if (request.method === "GET" && pathname === "/register") {
    return handleClientRegistration(request, env);
  }

  if (request.method === "POST" && pathname === "/token") {
    return handleTokenExchange(request, env);
  }

  if (request.method === "GET" && pathname === "/.well-known/oauth-authorization-server") {
    return new Response(JSON.stringify({
      issuer: new URL(request.url).origin,
      authorization_endpoint: `${new URL(request.url).origin}/authorize`,
      token_endpoint: `${new URL(request.url).origin}/token`,
      registration_endpoint: `${new URL(request.url).origin}/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["plain", "S256"],
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "GET" && pathname === "/.well-known/oauth-protected-resource") {
    return new Response(JSON.stringify({
      status: "protected",
      message: "This MCP server requires OAuth authentication",
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "GET" && pathname === "/authorize") {
    const url = new URL(request.url);
    const oauthClientId = url.searchParams.get("client_id");
    const oauthRedirectUri = url.searchParams.get("redirect_uri");
    const responseType = url.searchParams.get("response_type");
    const oauthScope = url.searchParams.get("scope");
    const oauthState = url.searchParams.get("state");
    const oauthCodeChallenge = url.searchParams.get("code_challenge");
    const oauthCodeChallengeMethod = url.searchParams.get("code_challenge_method");

    if (!oauthClientId || !oauthRedirectUri || responseType !== "code") {
      return new Response("Invalid request", { status: 400 });
    }

    const oauthReqInfo: AuthRequest = {
      clientId: oauthClientId,
      redirectUri: oauthRedirectUri,
      scope: oauthScope ? [oauthScope] : [],
      state: oauthState || crypto.randomUUID(),
      codeChallenge: oauthCodeChallenge || undefined,
      codeChallengeMethod: oauthCodeChallengeMethod || undefined,
      responseType: "code",
    };

    const stateToken = await createOAuthState(oauthReqInfo, env.OAUTH_KV);
    const { setCookie } = await bindStateToSession(stateToken);
    return redirectToAccess(request, env, oauthReqInfo, stateToken, { "Set-Cookie": setCookie });
  }

  if (request.method === "GET" && pathname === "/callback") {
    console.log("Callback received", {
      hasCode: !!searchParams.get("code"),
      hasError: !!searchParams.get("error"),
      hasState: !!searchParams.get("state"),
      error: searchParams.get("error"),
      errorDescription: searchParams.get("error_description"),
    });

    let oauthReqInfo: AuthRequest;
    let clearCookie: string;

    try {
      const result = await validateOAuthState(request, env.OAUTH_KV);
      oauthReqInfo = result.oauthReqInfo;
      clearCookie = result.clearCookie;
    } catch (error: any) {
      console.error("State validation failed:", {
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof OAuthError ? error.code : undefined,
        description: error instanceof OAuthError ? error.description : undefined,
      });
      if (error instanceof OAuthError) {
        return error.toResponse();
      }
      return new Response("Internal server error", { status: 500 });
    }

    if (!oauthReqInfo.clientId) {
      return new Response("Invalid OAuth request data", { status: 400 });
    }

    const urls = buildAccessUrls(env.ACCESS_TEAM_NAME, env.ACCESS_CLIENT_ID);
    const stateFromQuery = searchParams.get("state");

    const [accessToken, idToken, errResponse] = await fetchUpstreamAuthToken({
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      code: searchParams.get("code") ?? undefined,
      redirect_uri: new URL("/callback", request.url).href,
      upstream_url: urls.tokenUrl,
      state: stateFromQuery ?? undefined,
    });
    if (errResponse) {
      return errResponse;
    }

    const idTokenClaims = await verifyToken(urls.jwksUrl, idToken);
    const user = {
      email: idTokenClaims.email,
      name: idTokenClaims.name,
      sub: idTokenClaims.sub,
    };

    const authCode = crypto.randomUUID();
    await env.OAUTH_KV.put(`oauth:code:${authCode}`, JSON.stringify({
      clientId: oauthReqInfo.clientId,
      redirectUri: oauthReqInfo.redirectUri,
      scope: oauthReqInfo.scope.join(" "),
      userId: user.sub,
      accessToken,
      email: user.email,
      name: user.name,
    }), {
      expirationTtl: 600,
    });

    const clientRedirectUrl = new URL(oauthReqInfo.redirectUri);
    clientRedirectUrl.searchParams.set("code", authCode);
    clientRedirectUrl.searchParams.set("state", oauthReqInfo.state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: clientRedirectUrl.toString(),
        ...(clearCookie ? { "Set-Cookie": clearCookie } : {}),
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

async function redirectToAccess(
  request: Request,
  env: OAuthEnv,
  oauthReqInfo: AuthRequest,
  stateToken: string,
  headers: Record<string, string> = {},
) {
  const urls = buildAccessUrls(env.ACCESS_TEAM_NAME, env.ACCESS_CLIENT_ID);
  return new Response(null, {
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        client_id: env.ACCESS_CLIENT_ID,
        redirect_uri: new URL("/callback", request.url).href,
        scope: "openid email profile",
        state: stateToken,
        upstream_url: urls.authorizationUrl,
        code_challenge: oauthReqInfo.codeChallenge,
        code_challenge_method: oauthReqInfo.codeChallengeMethod,
      }),
    },
    status: 302,
  });
}

async function fetchAccessPublicKey(jwksUrl: string, kid: string) {
  const resp = await fetch(jwksUrl);
  const keys = (await resp.json()) as {
    keys: (JsonWebKey & { kid: string })[];
  };
  const jwk = keys.keys.filter((key) => key.kid === kid)[0];
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5",
    },
    false,
    ["verify"],
  );
  return key;
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+");
  str = str.replace(/_/g, "/");
  switch (str.length % 4) {
    case 0:
    return atob(str);
    case 2:
      return atob(str + "==");
    case 3:
      return atob(str + "=");
    default:
      throw new Error("Invalid base64url string");
  }
}

function parseJWT(token: string) {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 3) {
    throw new Error("token must have 3 parts");
  }

  return {
    data: `${tokenParts[0]}.${tokenParts[1]}`,
    header: JSON.parse(base64UrlDecode(tokenParts[0])),
    payload: JSON.parse(base64UrlDecode(tokenParts[1])),
    signature: tokenParts[2],
  };
}

async function verifyToken(jwksUrl: string, token: string) {
  const jwt = parseJWT(token);
  const key = await fetchAccessPublicKey(jwksUrl, jwt.header.kid);

  const encoder = new TextEncoder();
  const data = encoder.encode(jwt.data);
  const signature = Uint8Array.from(
    atob(jwt.signature)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    data,
  );

  if (!verified) {
    throw new Error("failed to verify token");
  }

  const claims = jwt.payload;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    throw new Error("expired token");
  }

  return claims;
}

async function handleClientRegistration(
  request: Request,
  env: EnvWithOauth,
): Promise<Response> {
  try {
    const body = await request.json() as any;

    if (!body.client_name || !body.redirect_uris) {
      return new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomUUID();

    await env.OAUTH_KV.put(`oauth:client:${clientId}`, JSON.stringify(body), {
      expirationTtl: 2592000,
    });

    return new Response(
      JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: Math.floor(Date.now() / 1000) + 2592000,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "server_error", error_description: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function handleTokenExchange(
  request: Request,
  env: EnvWithOauth,
): Promise<Response> {
  try {
    const formData = await request.formData();
    const clientId = formData.get("client_id");
    const clientSecret = formData.get("client_secret");
    const code = formData.get("code");
    const redirectUri = formData.get("redirect_uri");

    if (!clientId || !clientSecret || !code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const clientData = await env.OAUTH_KV.get(`oauth:client:${clientId}`);
    if (!clientData) {
      return new Response(
        JSON.stringify({ error: "invalid_client", error_description: "Invalid client credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const codeData = await env.OAUTH_KV.get(`oauth:code:${code}`);
    if (!codeData) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", error_description: "Invalid or expired code" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedCodeData = JSON.parse(codeData);
    if (parsedCodeData.clientId !== clientId || parsedCodeData.redirectUri !== redirectUri) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", error_description: "Code mismatch" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await env.OAUTH_KV.delete(`oauth:code:${code}`);

    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();

    await env.OAUTH_KV.put(`oauth:token:${accessToken}`, JSON.stringify({
      clientId,
      userId: parsedCodeData.userId,
      scopes: parsedCodeData.scope,
    }), {
      expirationTtl: 3600,
    });

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "server_error", error_description: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
