import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger, formatError } from "./utils/logger";

export class MCPServer extends McpAgent<Env> {
  server = new McpServer({
    name: "MCP Server Template",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "generate_uuid",
      "Generate random v4 UUID(s). count: 1-100 (default: 1)",
      { count: z.number().int().min(1).max(100).optional() },
      async ({ count = 1 }) => {
        logger.info("Tool invoked", { tool: "generate_uuid", params: { count } });

        try {
          const uuids: string[] = [];
          for (let i = 0; i < count; i++) {
            uuids.push(crypto.randomUUID());
          }

          logger.info("Tool completed", {
            tool: "generate_uuid",
            result: { count: uuids.length },
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, data: { uuids, count } }),
              },
            ],
          };
        } catch (error) {
          logger.error("Tool failed", {
            tool: "generate_uuid",
            error: formatError(error),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}
