import { env } from "../../config/index.js";
import { chunkRepository } from "../../repositories/index.js";
import { embeddingService } from "../embeddings/embedding.service.js";
import type { ChunkWithScore, Citation } from "../../types/index.js";
import { logger } from "../../utils/logger.js";

export interface RetrievalResult {
  chunks: ChunkWithScore[];
  citations: Citation[];
  context: string;
}

export class RetrievalService {
  async search(
    query: string,
    options?: { topK?: number; documentIds?: string[] },
  ): Promise<RetrievalResult> {
    const topK = options?.topK ?? env.RETRIEVAL_TOP_K;
    logger.info("Semantic search", { query: query.slice(0, 80), topK });

    const queryEmbedding = await embeddingService.embedText(query);
    const chunks = await chunkRepository.searchSimilar(
      queryEmbedding,
      topK,
      options?.documentIds,
    );

    const citations: Citation[] = chunks.map((c) => ({
      documentId: c.document_id,
      documentName: c.document_name,
      chunkIndex: c.chunk_index,
      chunkId: c.id,
      excerpt: c.content.slice(0, 200),
    }));

    const context = chunks
      .map(
        (c, i) =>
          `[Source ${i + 1}] Document: ${c.document_name} | Chunk: ${c.chunk_index}\n${c.content}`,
      )
      .join("\n\n---\n\n");

    return { chunks, citations, context };
  }
}

export const retrievalService = new RetrievalService();
