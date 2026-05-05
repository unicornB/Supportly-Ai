import type { Context, MiddlewareHandler } from "hono";
import { ZodError } from "zod";
import type { AppContext } from "../../config/env";
import { isAppError } from "../../shared/errors";
import { logger } from "../../shared/logger";

export function errorMiddleware(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      return errorResponse(error, c);
    }
  };
}

export function errorResponse(error: unknown, c: Context<AppContext>) {
  const requestId = c.get("requestId");

  if (isAppError(error)) {
    logger.warn("app_error", { requestId, code: error.code, message: error.message });
    return c.json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
  }

  if (error instanceof ZodError) {
    logger.warn("validation_error", { requestId, issues: error.issues });
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() } },
      400
    );
  }

  logger.error("unhandled_error", {
    requestId,
    message: error instanceof Error ? error.message : String(error),
  });
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
}
