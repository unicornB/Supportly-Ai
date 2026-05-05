import { Hono } from "hono";
import type { AppContext } from "../../config/env";
import { authMiddleware } from "../middleware/auth.middleware";
import { ok } from "../responses";

export const adminRoutes = new Hono<AppContext>();

adminRoutes.use("*", authMiddleware());
adminRoutes.get("/", (c) => ok({ ok: true }));
