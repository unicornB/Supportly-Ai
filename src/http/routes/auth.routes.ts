import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../config/env";
import { createServices } from "../../services";
import { authMiddleware } from "../middleware/auth.middleware";
import { ok } from "../responses";

export const authRoutes = new Hono<AppContext>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (c) => {
  const input = loginSchema.parse(await c.req.json());
  const services = createServices(c.env);
  return ok(await services.auth.login(input.email, input.password));
});

authRoutes.get("/me", authMiddleware(), (c) => ok(c.get("adminUser")));
