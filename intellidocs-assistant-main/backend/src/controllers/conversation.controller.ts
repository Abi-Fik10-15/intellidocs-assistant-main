import type { Request, Response, NextFunction } from "express";
import { conversationRepository } from "../repositories/index.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../middleware/error.middleware.js";

export async function listConversations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const conversations = await conversationRepository.findAll(limit, offset);

    sendSuccess(res, {
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id);
    const conversation = await conversationRepository.findById(id);
    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    const messages = await conversationRepository.getMessages(conversation.id);

    sendSuccess(res, {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}
