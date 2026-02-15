export interface Env {
  ACCESS_TEAM_NAME?: string;
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;
  OAUTH_KV?: KVNamespace;
}

export interface McpServerConfig {
  name: string;
  version: string;
}

export interface OAuthEnv extends Env {
  ACCESS_TEAM_NAME: string;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER?: unknown;
}
