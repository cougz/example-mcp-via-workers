# MCP Server Template

Production-ready MCP server template for Cloudflare Workers.

## Quick Start

```bash
bun install && bun run dev
# Connect MCP Inspector to http://localhost:8787/mcp
```

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

## Structure

```
src/
├── index.ts      # Entry point
├── types.ts      # Type definitions
├── tools/        # Add tools here
└── utils/        # Logging utilities
```

## Add a Tool

Edit `src/tools/index.ts`:

```typescript
export const tools: ToolDefinition[] = [
  {
    name: "my_tool",
    description: "What it does",
    inputSchema: { input: z.string() },
    handler: async (params) => ({ result: "..." }),
  },
];
```

## Client Config

### OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://my-server.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "my-server": { "url": "https://my-server.workers.dev/mcp" }
  }
}
```

## License

MIT
