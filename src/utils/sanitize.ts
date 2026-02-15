const SENSITIVE_FIELDS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "credential",
  "private_key",
  "access_token",
  "refresh_token",
  "auth",
  "key",
  "pass",
  "pwd",
  "privatekey",
  "secretkey",
]);

const REDACTED = "[REDACTED]";

export function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");

    if (SENSITIVE_FIELDS.has(key.toLowerCase()) || SENSITIVE_FIELDS.has(normalizedKey)) {
      sanitized[key] = REDACTED;
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeParams(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
