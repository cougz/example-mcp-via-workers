import type { PromptDefinition } from "../types";

export const prompts: PromptDefinition[] = [];

export function registerPrompts(server: {
  prompt: (
    name: string,
    description: string,
    args: Array<{ name: string; description?: string; required?: boolean }>,
    handler: (args: Record<string, string>) => Promise<{
      messages: Array<{
        role: "user" | "assistant";
        content: { type: "text"; text: string };
      }>;
    }>
  ) => void;
}) {
  for (const prompt of prompts) {
    server.prompt(
      prompt.name,
      prompt.description ?? "",
      prompt.arguments ?? [],
      async (args: Record<string, string>) => {
        return prompt.handler(args);
      }
    );
  }
}
