import type { Env } from "../types";

export function log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
}

export function logRequest(request: Request) {
  log("info", "Incoming request", {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  });
}

export function logError(error: unknown, context?: string) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  log("error", context || "Error occurred", {
    error: errorMessage,
    stack: errorStack,
  });
}

export function createErrorResponse(error: unknown) {
  logError(error, "Tool execution error");
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error occurred",
          success: false,
        }),
      },
    ],
    isError: true,
  };
}
