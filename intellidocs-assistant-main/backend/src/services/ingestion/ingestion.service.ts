import { env } from "../../config/index.js";
import { documentRepository, chunkRepository } from "../../repositories/index.js";
import { embeddingService } from "../embeddings/embedding.service.js";
import { n8nService } from "../integrations/n8n.service.js";
import { chunkText } from "../../utils/chunking.js";
import { readFileAsText } from "../../utils/file.js";
import { logger } from "../../utils/logger.js";

export class IngestionService {
  async ingestDocument(documentId: string): Promise<void> {
    const doc = await documentRepository.findById(documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    await documentRepository.updateStatus(documentId, "processing");

    try {
      const text = await readFileAsText(doc.file_path, doc.mime_type);
      if (!text.trim()) {
        throw new Error("No extractable text found in document");
      }

      await chunkRepository.deleteByDocumentId(documentId);

      const chunks = chunkText(
        text,
        env.CHUNK_SIZE_TOKENS,
        env.CHUNK_OVERLAP_TOKENS,
      );

      if (chunks.length === 0) {
        throw new Error("Document produced no chunks after processing");
      }

      const embeddings = await embeddingService.embedTexts(
        chunks.map((c) => c.content),
      );

      await chunkRepository.insertMany(
        documentId,
        chunks.map((c, i) => ({
          content: c.content,
          chunkIndex: c.chunkIndex,
          tokenCount: c.tokenCount,
          embedding: embeddings[i],
        })),
      );

      await documentRepository.updateStatus(documentId, "ready");
      logger.info("Document ingested", { documentId, chunkCount: chunks.length });

      await n8nService.notifyDocumentIngested({
        documentId,
        name: doc.name,
        chunkCount: chunks.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      await documentRepository.updateStatus(documentId, "failed", message);
      logger.error("Document ingestion failed", { documentId, error: message });
      throw err;
    }
  }
}

export const ingestionService = new IngestionService();
