const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Content-Type": "application/json",
};

const OPTIONS_RESPONSE = new Response(null, {
  status: 204,
  headers: CORS_HEADERS,
});

const ERROR_RESPONSE_BODY = JSON.stringify({ error: "Internal Server Error" });

function log(level: string, message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, message, ...data }));
}

function logError(error: unknown, context: string) {
  log("error", context, {
    error: error instanceof Error ? error.message : String(error),
  });
}

export function createErrorResponse(error: unknown) {
  logError(error, "Tool execution error");
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        }),
      },
    ],
    isError: true,
  };
}

export { CORS_HEADERS, OPTIONS_RESPONSE, ERROR_RESPONSE_BODY, log, logError };
