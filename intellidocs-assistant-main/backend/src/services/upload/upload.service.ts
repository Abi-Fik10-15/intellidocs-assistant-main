import path from "path";
import { v4 as uuidv4 } from "uuid";
import { documentRepository } from "../../repositories/index.js";
import { ingestionService } from "../ingestion/ingestion.service.js";
import { ensureUploadDir, isAllowedFile } from "../../utils/file.js";
import type { Document } from "../../types/index.js";
import { logger } from "../../utils/logger.js";

export class UploadService {
  async processUpload(file: Express.Multer.File): Promise<Document> {
    if (!isAllowedFile(file.mimetype, file.originalname)) {
      throw new Error("Invalid file type. Allowed: PDF, TXT, Markdown");
    }

    const uploadDir = await ensureUploadDir();
    const ext = path.extname(file.originalname);
    const storedName = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    const fs = await import("fs/promises");
    await fs.rename(file.path, filePath);

    const doc = await documentRepository.create({
      name: file.originalname,
      mimeType: file.mimetype,
      filePath,
      fileSize: file.size,
    });

    ingestionService.ingestDocument(doc.id).catch((err) => {
      logger.error("Background ingestion failed", {
        documentId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return doc;
  }
}

export const uploadService = new UploadService();
