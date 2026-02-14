import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createServer(): McpServer {
  const server = new McpServer({
    name: "UUID Generator MCP Server",
    version: "1.0.0",
  });

  server.tool(
    "generate_uuid",
    "Generate random v4 UUID(s). Use count parameter to generate multiple UUIDs (default: 1, max: 100).",
    {
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of UUIDs to generate (default: 1)"),
    },
    async ({ count = 1 }) => {
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                uuids,
                count: uuids.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const server = createServer();
    return createMcpHandler(server)(request, env, ctx);
  },
};
