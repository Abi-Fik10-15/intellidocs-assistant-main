import fs from "fs/promises";
import type { Request, Response, NextFunction } from "express";
import { documentRepository } from "../repositories/index.js";
import { ingestionService } from "../services/ingestion/ingestion.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../middleware/error.middleware.js";
import { logger } from "../utils/logger.js";

export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const documents = await documentRepository.findAll(limit, offset);

    sendSuccess(res, {
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        mimeType: d.mime_type,
        fileSize: d.file_size,
        errorMessage: d.error_message,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id);
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    sendSuccess(res, {
      id: document.id,
      name: document.name,
      status: document.status,
      mimeType: document.mime_type,
      fileSize: document.file_size,
      errorMessage: document.error_message,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id);
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    await documentRepository.delete(id);

    try {
      await fs.unlink(document.file_path);
    } catch (err) {
      logger.warn("Could not delete document file from disk", {
        id,
        path: document.file_path,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    sendSuccess(res, { id, deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function reingestDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id);
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    const updated = await documentRepository.updateStatus(id, "processing", null);
    void ingestionService.ingestDocument(id).catch(() => {});

    sendSuccess(res, {
      id: updated!.id,
      name: updated!.name,
      status: updated!.status,
      mimeType: updated!.mime_type,
      fileSize: updated!.file_size,
      errorMessage: null,
      createdAt: updated!.created_at,
      updatedAt: updated!.updated_at,
    });
  } catch (err) {
    next(err);
  }
}
