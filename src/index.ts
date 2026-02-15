server.tool(
  "generate_uuid",
  "Generate random v4 UUID(s). count: 1-100 (default: 1)",
  { count: z.number().min(1).max(100).default(1) },
  async ({ count }) => {
    const uuids = Array.from({ length: count }, () => crypto.randomUUID());
    return { content: [{ type: "text", text: JSON.stringify({ uuids, count }) }];
  } as unknown,
);
