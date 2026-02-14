# MCP Server Template

A production-ready Model Context Protocol (MCP) server template for Cloudflare Workers.

## Features

- **Streamable HTTP Transport** - Current MCP specification standard
- **TypeScript** - Full type safety with strict mode
- **Zod Validation** - Input schema validation for tools
- **Structured Logging** - JSON logs for observability
- **CORS Support** - Browser-based MCP clients
- **Observability** - Logs & traces enabled via Cloudflare
- **Testing** - Vitest setup with coverage
- **Modular Structure** - Tools, resources, prompts separated

## Quick Start

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Test with MCP Inspector
bun run inspector
# Then connect to http://localhost:8787/mcp

# Run tests
bun run test

# Deploy to Cloudflare
bun run deploy
```

## Project Structure

```
├── src/
│   ├── index.ts          # Entry point & handler
│   ├── types.ts          # Type definitions
│   ├── tools/
│   │   ├── index.ts      # Tool registry
│   │   └── uuid.schema.ts # Example tool schema
│   ├── resources/
│   │   └── index.ts      # Resource registry
│   ├── prompts/
│   │   └── index.ts      # Prompt registry
│   └── utils/
│       └── logger.ts     # Logging utilities
├── tests/
│   └── server.test.ts    # Unit tests
├── wrangler.jsonc        # Cloudflare config
├── vitest.config.ts      # Test config
└── package.json
```

## Adding a New Tool

1. Create schema in `src/tools/my-tool.schema.ts`:

```typescript
import { z } from "zod";

export const myToolSchema = {
  input: z.string().describe("Input description"),
};

export type MyToolParams = z.infer<z.ZodObject<typeof myToolSchema>>;

export const myToolDefinition = {
  name: "my_tool",
  description: "What this tool does",
  inputSchema: myToolSchema,
};
```

2. Register in `src/tools/index.ts`:

```typescript
import { myToolDefinition, type MyToolParams } from "./my-tool.schema";

async function handleMyTool(params: MyToolParams, context: ToolContext) {
  return { result: "..." };
}

export const tools: ToolRegistry = [
  { ...myToolDefinition, handler: handleMyTool },
  // ... other tools
];
```

## Adding Resources

Edit `src/resources/index.ts`:

```typescript
export const resources: ResourceDefinition[] = [
  {
    uri: "resource://my-resource",
    name: "My Resource",
    mimeType: "application/json",
    handler: async (uri) => ({
      content: JSON.stringify({ data: "..." }),
    }),
  },
];
```

## Adding Prompts

Edit `src/prompts/index.ts`:

```typescript
export const prompts: PromptDefinition[] = [
  {
    name: "my_prompt",
    description: "Prompt description",
    arguments: [
      { name: "topic", description: "Topic to discuss", required: true },
    ],
    handler: async (args) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: `Tell me about ${args.topic}` },
        },
      ],
    }),
  },
];
```

## Configuration

### Server Metadata

Edit `src/index.ts`:

```typescript
const SERVER_CONFIG: McpServerConfig = {
  name: "My MCP Server",
  version: "1.0.0",
};
```

### Cloudflare Settings

Edit `wrangler.jsonc`:

```jsonc
{
  "name": "my-mcp-server",
  "main": "src/index.ts",
  "compatibility_date": "2026-02-14",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "logs": { "enabled": true, "head_sampling_rate": 0.1 },
    "traces": { "enabled": true, "head_sampling_rate": 0.1 }
  }
}
```

### Staging Environment

Add to `wrangler.jsonc`:

```jsonc
{
  "env": {
    "staging": {
      "name": "my-mcp-server-staging"
    }
  }
}
```

## Authentication (Optional)

For OAuth-protected servers, use Cloudflare Access:

1. Follow [Secure MCP servers with Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/)
2. Add `workers-oauth-provider` package
3. Wrap handler with OAuth provider

## Testing

```bash
# Run tests
bun run test

# Watch mode
bun run test:watch

# Coverage
bun run test:coverage
```

## Deployment

```bash
# Deploy to production
bun run deploy

# Deploy to staging
bun run deploy:staging
```

## MCP Client Configuration

### Claude Desktop / Cursor

Add to your MCP client config:

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://my-mcp-server.my-account.workers.dev/mcp"
    }
  }
}
```

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-mcp-server": {
      "type": "remote",
      "url": "https://my-mcp-server.my-account.workers.dev/mcp",
      "enabled": true,
      "headers": {}
    }
  }
}
```

#### OpenCode with Custom Headers

For authenticated servers:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-mcp-server": {
      "type": "remote",
      "url": "https://my-mcp-server.my-account.workers.dev/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

#### OpenCode with Cloudflare Access

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-mcp-server": {
      "type": "remote",
      "url": "https://my-mcp-server.my-account.workers.dev/mcp",
      "enabled": true,
      "headers": {
        "CF-Access-Client-Id": "your-client-id",
        "CF-Access-Client-Secret": "your-client-secret"
      }
    }
  }
}
```

## License

MIT
