import type { Request, Response, NextFunction } from "express";
import { agentService } from "../services/agent/agent.service.js";
import { sendSuccess } from "../utils/api-response.js";

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message, conversationId, documentIds } = req.body as {
      message: string;
      conversationId?: string;
      documentIds?: string[];
    };

    const result = await agentService.chat(message, conversationId, documentIds);

    sendSuccess(res, {
      answer: result.answer,
      citations: result.citations,
      conversationId: result.conversationId,
      messageId: result.messageId,
    });
  } catch (err) {
    next(err);
  }
}
