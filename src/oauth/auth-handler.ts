import type { OAuthEnv } from "../types";
import { log } from "../utils/logger";

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Server Authorization</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    p { color: #aaa; margin-bottom: 1.5rem; }
    button { background: #e94560; color: white; border: none; padding: 0.75rem 2rem; font-size: 1rem; border-radius: 8px; cursor: pointer; }
    button:hover { background: #ff6b6b; }
    .hidden { display: none; }
    .error { color: #e94560; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="title">MCP Server Authorization</h1>
    <p id="message">Click below to authorize access to this MCP server.</p>
    <button id="authorize-btn" onclick="authorize()">Authorize</button>
    <p id="error" class="error hidden"></p>
  </div>
  <script>
    async function authorize() {
      const btn = document.getElementById('authorize-btn');
      const errorEl = document.getElementById('error');
      const titleEl = document.getElementById('title');
      const msgEl = document.getElementById('message');
      
      btn.disabled = true;
      btn.textContent = 'Authorizing...';
      errorEl.classList.add('hidden');
      
      try {
        const url = new URL(window.location.href);
        const response = await fetch('/oauth/complete' + url.search);
        
        if (response.ok) {
          const data = await response.json();
          if (data.redirect) {
            titleEl.textContent = 'Success!';
            msgEl.textContent = 'Redirecting...';
            window.location.href = data.redirect;
          }
        } else {
          const err = await response.json();
            throw new Error(err.error || 'Authorization failed');
          }
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Authorize';
        errorEl.textContent = e.message;
        errorEl.classList.remove('hidden');
      }
    }
  </script>
</body>
</html>`;

interface OAuthHelpers {
  parseAuthRequest: (request: Request) => Promise<{
    clientId: string;
    redirectUri: string;
    scope?: string[];
    state?: string;
  }>;
  completeAuthorization: (options: {
    request: { clientId: string; redirectUri: string; scope?: string[]; state?: string };
    userId: string;
    metadata?: Record<string, unknown>;
    scope?: string[];
    props?: Record<string, unknown>;
  }) => Promise<{ redirectTo: string }>;
}

interface EnvWithProvider extends OAuthEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAuthHandler(): any {
  return {
    async fetch(request: Request, env: EnvWithProvider): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/authorize") {
        log("info", "Authorization request received", {
          client_id: url.searchParams.get("client_id"),
          redirect_uri: url.searchParams.get("redirect_uri"),
        });

        return new Response(HTML_CONTENT, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (path === "/oauth/complete") {
        try {
          const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);

          if (!oauthReqInfo) {
            return new Response(JSON.stringify({ error: "Invalid OAuth request" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
            request: oauthReqInfo,
            userId: "user",
            metadata: { authorizedAt: new Date().toISOString() },
            scope: oauthReqInfo.scope || [],
            props: { authorized: true },
          });

          return new Response(JSON.stringify({ redirect: redirectTo }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          log("error", "OAuth completion failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Authorization failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return new Response("Not found", { status: 404 });
    },
  };
}
