import { Hono } from "hono";
import type { AppContext } from "../../config/env";

export const healthRoutes = new Hono<AppContext>();

healthRoutes.get("/", (c) => c.json({ ok: true }));
