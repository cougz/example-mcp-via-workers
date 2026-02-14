import type { Env } from "../types";
import { z } from "zod";
import { createErrorResponse } from "../utils/logger";

export type ToolContext = {
  env: Env;
  ctx: ExecutionContext;
  request: Request;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType<unknown>>;
  handler: (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
};

export const generateUuidSchema = {
  count: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of UUIDs to generate (default: 1)"),
};

async function handleGenerateUuid(params: Record<string, unknown>, context: ToolContext) {
  const count = (params.count as number | undefined) ?? 1;
  const uuids = Array.from({ length: count }, () => crypto.randomUUID());

  return {
    uuids,
    count: uuids.length,
    generatedAt: new Date().toISOString(),
  };
}

export const tools: ToolDefinition[] = [
  {
    name: "generate_uuid",
    description:
      "Generate random v4 UUID(s). Use count parameter to generate multiple UUIDs (default: 1, max: 100).",
    inputSchema: generateUuidSchema,
    handler: handleGenerateUuid,
  },
];

export function registerTools(
  server: {
    tool: (
      name: string,
      description: string,
      schema: Record<string, z.ZodType<unknown>>,
      handler: (params: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>;
        isError?: boolean;
      }>
    ) => void;
  },
  context: ToolContext
) {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputSchema, async (params: Record<string, unknown>) => {
      try {
        const result = await tool.handler(params, context);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    });
  }
}
