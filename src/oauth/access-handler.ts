import type { AuthRequest, OAuthHelpers, ClientInfo } from "@cloudflare/workers-oauth-provider";
import type { OAuthEnv } from "../types";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  fetchUpstreamAuthToken,
  generateCSRFProtection,
  getUpstreamAuthorizeUrl,
  isClientApproved,
  OAuthError,
  type Props,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./utils";

type EnvWithOauth = OAuthEnv & { OAUTH_PROVIDER: OAuthHelpers };

function buildAccessUrls(teamName: string, clientId: string) {
  const baseUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${clientId}`;
  return {
    tokenUrl: `${baseUrl}/token`,
    authorizationUrl: `${baseUrl}/authorization`,
    jwksUrl: `${baseUrl}/jwks`,
  };
}

export async function handleAccessRequest(
  request: Request,
  env: EnvWithOauth,
  _ctx: ExecutionContext,
) {
  const { pathname, searchParams } = new URL(request.url);

  if (request.method === "GET" && pathname === "/authorize") {
    const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const { clientId, state } = oauthReqInfo;
    if (!clientId) {
      return new Response("Invalid request", { status: 400 });
    }

    if (await isClientApproved(request, clientId, env.COOKIE_ENCRYPTION_KEY)) {
      const stateToken = await createOAuthState(oauthReqInfo, env.OAUTH_KV);
      const { setCookie } = await bindStateToSession(stateToken);
      return redirectToAccess(request, env, oauthReqInfo, stateToken, { "Set-Cookie": setCookie });
    }

    const { token: csrfToken, setCookie } = generateCSRFProtection();

    return renderApprovalDialog(request, {
      client: await env.OAUTH_PROVIDER.lookupClient(clientId),
      csrfToken,
      server: {
        description: "This MCP server uses Cloudflare Access for authentication.",
        logo: "https://avatars.githubusercontent.com/u/314135?s=200&v=4",
        name: "Cloudflare Access MCP Server",
      },
      setCookie,
      state: { oauthReqInfo },
    });
  }

  if (request.method === "POST" && pathname === "/authorize") {
    try {
      const formData = await request.formData();

      validateCSRFToken(formData, request);

      const encodedState = formData.get("state");
      if (!encodedState || typeof encodedState !== "string") {
        return new Response("Missing state in form data", { status: 400 });
      }

      let state: { oauthReqInfo?: AuthRequest };
      try {
        state = JSON.parse(atob(encodedState));
      } catch (_e) {
        return new Response("Invalid state data", { status: 400 });
      }

      if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
        return new Response("Invalid request", { status: 400 });
      }

      const approvedClientCookie = await addApprovedClient(
        request,
        state.oauthReqInfo.clientId,
        env.COOKIE_ENCRYPTION_KEY,
      );

      const stateToken = await createOAuthState(state.oauthReqInfo, env.OAUTH_KV);
      const { setCookie: stateCookie } = await bindStateToSession(stateToken);

      return redirectToAccess(request, env, state.oauthReqInfo, stateToken, {
        "Set-Cookie": `${approvedClientCookie}; ${stateCookie}`,
      });
    } catch (error: any) {
      console.error("POST /authorize error:", error);
      if (error instanceof OAuthError) {
        return error.toResponse();
      }
      return new Response(`Internal server error: ${error.message}`, { status: 500 });
    }
  }

  if (request.method === "GET" && pathname === "/callback") {
    let oauthReqInfo: AuthRequest;
    let clearCookie: string;

    try {
      const result = await validateOAuthState(request, env.OAUTH_KV);
      oauthReqInfo = result.oauthReqInfo;
      clearCookie = result.clearCookie;
    } catch (error: any) {
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

    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      metadata: {
        label: user.name,
      },
      props: {
        accessToken,
        email: user.email,
        login: user.sub,
        name: user.name,
      } as Props,
      request: oauthReqInfo,
      scope: oauthReqInfo.scope,
      userId: user.sub,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
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
  const decoder = new TextDecoder();
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
