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
├── index.ts      # Entry point (OAuth detection)
├── mcp-server.ts # MCP server factory
├── types.ts      # Type definitions
├── oauth/        # OAuth support (lazy-loaded)
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

---

## OAuth Authentication (Optional)

The server runs in **public mode** by default. Enable OAuth to protect with Cloudflare Access.

### Prerequisites

- Cloudflare Zero Trust organization
- Identity provider configured (Pocket ID, GitHub, Google, etc.)
- Workers KV namespace

### Step 1: Create KV Namespace

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **KV**
2. Click **Create a namespace**
3. Name it `mcp-server-oauth`
4. Copy the **Namespace ID**

### Step 2: Update `wrangler.jsonc`

Uncomment and update the `kv_namespaces` block:

```jsonc
{
  // ... other config ...
  "kv_namespaces": [
    { "binding": "OAUTH_KV", "id": "YOUR_KV_NAMESPACE_ID" }
  ]
}
```

### Step 3: Configure Identity Provider

Add your IdP (e.g., Pocket ID) in **Cloudflare One**:

1. Go to **Cloudflare One** → **Integrations** → **Identity Providers**
2. Click **Add new identity provider** → **OpenID Connect**
3. Configure with your IdP details:

| Field | Example Value |
|-------|---------------|
| Name | `Pocket ID` |
| App ID | From your IdP |
| Client Secret | From your IdP |
| Auth URL | `https://pocket-id.example.com/authorize` |
| Token URL | `https://pocket-id.example.com/api/oidc/token` |
| Userinfo URL | `https://pocket-id.example.com/api/oidc/userinfo` |
| Certificate URL | `https://pocket-id.example.com/.well-known/jwks.json` |

4. In your IdP, add callback URL: `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`

### Step 4: Create Access for SaaS Application

1. Go to **Cloudflare One** → **Access controls** → **Applications**
2. Click **Add an application** → **SaaS**
3. Configure:

| Field | Value |
|-------|-------|
| Name | `MCP Server` |
| Authentication | OIDC |
| Redirect URL | `https://your-worker.workers.dev/callback` |
| Identity Providers | Select your IdP |
| Access Policy | Configure who can access |

4. After saving, copy these values:
   - Client ID
   - Client Secret
   - Token endpoint
   - Authorization endpoint
   - Key endpoint

### Step 5: Add Worker Secrets

In **Cloudflare Dashboard** → **Workers & Pages** → **your-worker** → **Settings** → **Variables and Secrets**:

| Secret | Source |
|--------|--------|
| `ACCESS_CLIENT_ID` | From SaaS app |
| `ACCESS_CLIENT_SECRET` | From SaaS app |
| `ACCESS_TOKEN_URL` | Token endpoint from SaaS app |
| `ACCESS_AUTHORIZATION_URL` | Authorization endpoint from SaaS app |
| `ACCESS_JWKS_URL` | Key endpoint from SaaS app |
| `COOKIE_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` |

### Step 6: Deploy

Push to GitHub. Workers Builds will auto-deploy.

### Verify

1. Connect MCP client to `https://your-worker.workers.dev/mcp`
2. OAuth flow should trigger automatically
3. After authentication, MCP tools will be available

### Partial Configuration Warning

If some OAuth secrets are configured but not all, the server logs a warning and runs in public mode. Check Worker logs if OAuth isn't working.

## License

MIT
