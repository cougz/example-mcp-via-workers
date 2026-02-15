export interface Env {
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;
  ACCESS_TOKEN_URL?: string;
  ACCESS_AUTHORIZATION_URL?: string;
  ACCESS_JWKS_URL?: string;
  COOKIE_ENCRYPTION_KEY?: string;
  OAUTH_KV?: KVNamespace;
}

export interface McpServerConfig {
  name: string;
  version: string;
}

export interface OAuthEnv extends Env {
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_JWKS_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER?: unknown;
}
