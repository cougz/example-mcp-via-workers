# MCP Server Template

Production-ready MCP server template for Cloudflare Workers using the McpAgent pattern.

## Quick Start

```bash
bun install && bun run dev
# Connect MCP Inspector to http://localhost:8787/mcp
# or http://localhost:8787/agents/mcp-server/default/mcp (new pattern)
```

Note: `/mcp` is a backwards-compatible route that forwards to `/agents/mcp-server/default/mcp`.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Local development |
| `bun run test` | Run tests |
| `bun run deploy` | Deploy to production |
| `bun run deploy:staging` | Deploy to staging |

## Environments

| Environment | Logs | Traces | Use Case |
|-------------|------|--------|----------|
| Production | 10% | 1% | Cost-optimized for high traffic |
| Staging | 100% | 10% | Full visibility for debugging |

Sampling rates control what percentage of requests are logged/traced. Lower rates reduce costs while maintaining observability.

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|----------|
| `CORS_ORIGIN` | Allowed CORS origin (default: `*`) | `https://myapp.com` |

Set via wrangler:
```bash
wrangler secret put CORS_ORIGIN
```

## Structure

```
src/
├── index.ts        # Entry point with health check & CORS
├── mcp-agent.ts    # McpAgent class with tools
├── types.ts        # Type definitions
└── utils/          # Logging utilities
    ├── logger.ts    # Structured logging
    └── sanitize.ts # Param sanitization
```

## Add a Tool

Edit `src/mcp-agent.ts`:

```typescript
import { z } from "zod";

export class MCPServer extends McpAgent<Env> {
  async init() {
    this.server.tool(
      "my_tool",
      "What it does",
      { input: z.string() },
      async ({ input }) => ({
        content: [{ type: "text", text: JSON.stringify({ result: input }) }],
      }),
    );
  }
}
```

Zod schemas are validated automatically by the MCP SDK.

## Client Config

### OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://my-worker.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "my-server": { "url": "https://my-worker.workers.dev/mcp" }
  }
}
```

**Note**: Both `/mcp` (backwards-compatible) and `/agents/mcp-server/default/mcp` (agent pattern) work as endpoints.

## Features

- **Structured Logging**: All logs include request ID, timestamps, and context
- **Error Tracking**: Stack traces captured and visible in Cloudflare Observability
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Configurable CORS**: Restrict to specific origins via `CORS_ORIGIN` env var
- **Health Check**: `/health` endpoint for monitoring
- **Param Sanitization**: Sensitive fields (password, token, api_key) automatically redacted in logs

## License

MIT
