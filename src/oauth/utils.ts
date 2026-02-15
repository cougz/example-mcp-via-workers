import type { AuthRequest } from "@cloudflare/workers-oauth-provider";

export class OAuthError extends Error {
  constructor(
    public code: string,
    public description: string,
    public statusCode = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: this.code,
        error_description: this.description,
      }),
      {
        status: this.statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export interface ValidateStateResult {
  oauthReqInfo: AuthRequest;
  clearCookie: string;
}

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600,
): Promise<string> {
  const state = oauthReqInfo.state || crypto.randomUUID();
  const codeVerifier = (oauthReqInfo as any).codeVerifier || crypto.randomUUID();
  const stateData = {
    clientId: oauthReqInfo.clientId,
    redirectUri: oauthReqInfo.redirectUri,
    scope: oauthReqInfo.scope,
    state: oauthReqInfo.state,
    codeChallenge: oauthReqInfo.codeChallenge,
    codeChallengeMethod: oauthReqInfo.codeChallengeMethod,
    _codeVerifier: codeVerifier,
  };
  await kv.put(`oauth:state:${state}`, JSON.stringify(stateData), {
    expirationTtl: stateTTL,
  });
  return state;
}

export async function bindStateToSession(stateToken: string): Promise<{ setCookie: string }> {
  const sessionStateCookieName = "__Host-OAUTH_STATE";

  const encoder = new TextEncoder();
  const data = encoder.encode(stateToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const setCookie = `${sessionStateCookieName}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { setCookie };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<ValidateStateResult> {
  const sessionStateCookieName = "__Host-OAUTH_STATE";
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");

  if (!stateFromQuery) {
    throw new OAuthError("invalid_request", "Missing state parameter", 400);
  }

  const storedDataJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedDataJson) {
    throw new OAuthError("invalid_request", "Invalid or expired state", 400);
  }

  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sessionStateCookie = cookies.find((c) => c.startsWith(`${sessionStateCookieName}=`));
    const sessionStateHash = sessionStateCookie
      ? sessionStateCookie.substring(sessionStateCookieName.length + 1)
      : null;

    if (!sessionStateHash) {
      throw new OAuthError(
        "invalid_request",
        "Missing session binding cookie - authorization flow must be restarted",
        400,
      );
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(stateFromQuery);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const stateHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (stateHash !== sessionStateHash) {
      throw new OAuthError(
        "invalid_request",
        "State token does not match session - possible CSRF attack detected",
        400,
      );
    }
  } catch (error: any) {
    if (error instanceof OAuthError) {
      throw error;
    }
    console.error("Session validation error:", {
      error: error instanceof Error ? error.message : String(error),
      state: stateFromQuery,
      hasCookie: !!request.headers.get("Cookie"),
    });
    throw new OAuthError("server_error", "Session validation failed", 500);
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedDataJson) as AuthRequest;
  } catch (_e) {
    throw new OAuthError("server_error", "Invalid state data", 500);
  }

  await kv.delete(`oauth:state:${stateFromQuery}`);
  const clearCookie = `${sessionStateCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;

  return { oauthReqInfo, clearCookie };
}

export function getUpstreamAuthorizeUrl(params: {
  upstream_url: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: string;
}): string {
  const url = new URL(params.upstream_url);
  url.searchParams.set("client_id", params.client_id);
  url.searchParams.set("redirect_uri", params.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  if (params.code_challenge) {
    url.searchParams.set("code_challenge", params.code_challenge);
  }
  if (params.code_challenge_method) {
    url.searchParams.set("code_challenge_method", params.code_challenge_method);
  }
  return url.toString();
}

export async function fetchUpstreamAuthToken(params: {
  upstream_url: string;
  client_id: string;
  client_secret: string;
  code?: string;
  redirect_uri: string;
  state?: string;
}): Promise<[string, string, null] | [null, null, Response]> {
  if (!params.code) {
    return [null, null, new Response("Missing authorization code", { status: 400 })];
  }

  const data = new URLSearchParams({
    client_id: params.client_id,
    client_secret: params.client_secret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirect_uri,
  });

  if (params.state) {
    data.set("state", params.state);
  }

  console.log("Token exchange request:", {
    url: params.upstream_url,
    code_present: !!params.code,
    redirect_uri: params.redirect_uri,
    state_present: !!params.state,
  });

  const response = await fetch(params.upstream_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: data.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return [
      null,
      null,
      new Response(`Failed to exchange code for token: ${errorText}`, {
        status: response.status,
      }),
    ];
  }

  const body = (await response.json()) as any;
  const accessToken = body.access_token as string;
  if (!accessToken) {
    return [null, null, new Response("Missing access token", { status: 400 })];
  }

  const idToken = body.id_token as string;
  if (!idToken) {
    return [null, null, new Response("Missing id token", { status: 400 })];
  }

  return [accessToken, idToken, null];
}
