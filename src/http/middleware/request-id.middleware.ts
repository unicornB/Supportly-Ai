import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../../config/env";
import { createId } from "../../shared/ids";

export function requestIdMiddleware(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") || createId("req");
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  };
}
