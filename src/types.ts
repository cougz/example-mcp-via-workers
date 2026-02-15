import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
  CORS_ORIGIN?: string;
  MCPServer: DurableObjectNamespace;
}
