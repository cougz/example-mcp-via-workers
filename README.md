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
| `bun run deploy` | Deploy to Cloudflare |

## Structure

```
src/
├── index.ts      # Entry point
├── tools/        # Add tools here
├── resources/    # Add resources here
├── prompts/      # Add prompts here
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
    handler: async (params, context) => ({ result: "..." }),
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
