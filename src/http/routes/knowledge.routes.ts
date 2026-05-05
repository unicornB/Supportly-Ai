import { Hono } from "hono";
import type { AppContext } from "../../config/env";
import { AppError } from "../../shared/errors";
import { createServices } from "../../services";
import { authMiddleware } from "../middleware/auth.middleware";
import { created, noContent, ok } from "../responses";

export const knowledgeRoutes = new Hono<AppContext>();

knowledgeRoutes.use("*", authMiddleware());

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "arrayBuffer" in value
  );
}

knowledgeRoutes.get("/documents", async (c) => {
  const services = createServices(c.env);
  return ok(await services.knowledge.listDocuments());
});

knowledgeRoutes.post("/documents", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    throw new AppError("VALIDATION_ERROR", "file is required", 400);
  }

  const title = formData.get("title");
  const services = createServices(c.env);
  return created(
    await services.knowledge.uploadDocument({
      file,
      title: typeof title === "string" ? title : undefined,
      createdByAdminUserId: c.get("adminUserId"),
    })
  );
});

knowledgeRoutes.post("/sync/ai-search", async (c) => {
  const services = createServices(c.env);
  return ok(await services.knowledge.syncFromAiSearch());
});

knowledgeRoutes.delete("/documents/:id", async (c) => {
  const services = createServices(c.env);
  await services.knowledge.deleteDocument(c.req.param("id"));
  return noContent();
});
