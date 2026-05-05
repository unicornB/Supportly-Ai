import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";

export function authMiddleware(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const adminUserId = c.req.header("x-admin-user-id");
    const authorization = c.req.header("authorization");
    const services = createServices(c.env);
    const user = await services.auth.requireAdminUser({ adminUserId, authorization });
    c.set("adminUserId", user.id);
    c.set("adminUser", {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await next();
  };
}
