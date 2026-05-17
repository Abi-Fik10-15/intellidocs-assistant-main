import { env } from "../../config/index.js";
import { getLlmGateway } from "../llm/index.js";
import { createGeminiEmbeddings, createGeminiEmbedding } from "./gemini-embedding.js";
import { createMockEmbedding } from "./mock-embedding.js";
import { logger } from "../../utils/logger.js";

const BATCH_SIZE = 20;

export class EmbeddingService {
  private useMock(): boolean {
    return env.EMBEDDING_PROVIDER === "mock";
  }

  private useGemini(): boolean {
    return env.EMBEDDING_PROVIDER === "gemini";
  }

  async embedText(text: string): Promise<number[]> {
    if (this.useMock()) {
      return createMockEmbedding(text);
    }
    if (this.useGemini()) {
      return createGeminiEmbedding(text);
    }
    return getLlmGateway().createEmbedding(text);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.useMock()) {
      logger.debug("Using mock embeddings (no OpenAI API calls)");
      return texts.map((t) => createMockEmbedding(t));
    }

    if (this.useGemini()) {
      logger.debug("Using Gemini embeddings");
      return createGeminiEmbeddings(texts);
    }

    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      logger.debug(`Embedding batch ${i / BATCH_SIZE + 1}`, { count: batch.length });
      const batchEmbeddings = await getLlmGateway().createEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
    }
    return embeddings;
  }
}

export const embeddingService = new EmbeddingService();
