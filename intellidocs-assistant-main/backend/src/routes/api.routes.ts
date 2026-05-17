import { Router } from "express";
import { z } from "zod";
import { upload } from "../middleware/upload.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import * as uploadController from "../controllers/upload.controller.js";
import * as chatController from "../controllers/chat.controller.js";
import * as conversationController from "../controllers/conversation.controller.js";
import * as documentController from "../controllers/document.controller.js";
import * as healthController from "../controllers/health.controller.js";
import * as settingsController from "../controllers/settings.controller.js";

const chatBodySchema = z.object({
  message: z.string().min(1).max(32_000),
  conversationId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

const llmProviderBodySchema = z.object({
  provider: z.enum(["openai", "claude", "gemini"]),
});

export const apiRouter = Router();

apiRouter.get("/health", healthController.health);

apiRouter.get("/settings", settingsController.getSettings);
apiRouter.patch(
  "/settings/llm-provider",
  validateBody(llmProviderBodySchema),
  settingsController.updateLlmProvider,
);

apiRouter.post("/upload", upload.single("file"), uploadController.uploadDocument);

apiRouter.post("/chat", validateBody(chatBodySchema), chatController.chat);

apiRouter.get("/conversations", conversationController.listConversations);
apiRouter.get("/conversations/:id", conversationController.getConversation);

apiRouter.get("/documents", documentController.listDocuments);
apiRouter.get("/documents/:id", documentController.getDocument);
apiRouter.delete("/documents/:id", documentController.deleteDocument);
apiRouter.post("/documents/:id/reingest", documentController.reingestDocument);
