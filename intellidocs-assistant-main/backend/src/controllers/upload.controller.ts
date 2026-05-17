import type { Request, Response, NextFunction } from "express";
import { uploadService } from "../services/upload/upload.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../middleware/error.middleware.js";

export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError("No file uploaded", 400, "NO_FILE");
    }

    const document = await uploadService.processUpload(req.file);
    sendSuccess(
      res,
      {
        id: document.id,
        name: document.name,
        status: document.status,
        mimeType: document.mime_type,
        fileSize: document.file_size,
        createdAt: document.created_at,
      },
      201,
    );
  } catch (err) {
    next(err);
  }
}
