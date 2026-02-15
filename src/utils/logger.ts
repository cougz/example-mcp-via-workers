import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  tool?: string;
  durationMs?: number;
  status?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const ctx = asyncLocalStorage.getStore();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
    ...data,
  };

  switch (level) {
    case "error":
      console.error(entry);
      break;
    case "warn":
      console.warn(entry);
      break;
    case "debug":
      console.log(entry);
      break;
    default:
      console.log(entry);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
};

export function formatError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
  };
}
