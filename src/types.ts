export interface Env {}

export interface ToolContext {
  env: Env;
  ctx: ExecutionContext;
  request: Request;
}

export interface ToolHandler<T = unknown> {
  (params: T, context: ToolContext): Promise<unknown>;
}

export interface ToolDefinition<T = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler<T>;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: (uri: URL) => Promise<{ content: string; mimeType?: string }>;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  handler: (args: Record<string, string>) => Promise<{
    messages: Array<{
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }>;
  }>;
}

export interface McpServerConfig {
  name: string;
  version: string;
}
