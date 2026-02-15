import { z } from "zod";
import { logger, formatError } from "../utils/logger";
import { sanitizeParams } from "../utils/sanitize";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType<unknown>>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
};

const generateUuidSchema = {
  count: z.number().int().min(1).max(100).optional(),
};

async function handleGenerateUuid(params: Record<string, unknown>) {
  const count = (params.count as number | undefined) ?? 1;
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID());
  }
  return { uuids, count };
}

export const tools: ToolDefinition[] = [
  {
    name: "generate_uuid",
    description: "Generate random v4 UUID(s). count: 1-100 (default: 1)",
    inputSchema: generateUuidSchema,
    handler: handleGenerateUuid,
  },
];

export function registerTools(server: {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodType<unknown>>,
    handler: (params: Record<string, unknown>) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      isError?: boolean;
    }>
  ) => void;
}) {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputSchema, async (params: Record<string, unknown>) => {
      const startTime = Date.now();
      const sanitizedParams = sanitizeParams(params);

      logger.info("Tool invoked", { tool: tool.name, params: sanitizedParams });

      try {
        const result = await tool.handler(params);

        logger.info("Tool completed", {
          tool: tool.name,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, data: result }) }],
        };
      } catch (error) {
        logger.error("Tool failed", {
          tool: tool.name,
          params: sanitizedParams,
          error: formatError(error),
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }
}
