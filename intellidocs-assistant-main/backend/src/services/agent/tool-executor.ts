import { chunkRepository } from "../../repositories/index.js";
import { retrievalService } from "../retrieval/retrieval.service.js";
import { getLlmGateway } from "../llm/index.js";
import { logger } from "../../utils/logger.js";
import type { Citation, Document } from "../../types/index.js";
import { resolveDocumentForTool } from "./document-resolver.js";

export interface ToolExecutionResult {
  output: string;
  citations: Citation[];
}

export class ToolExecutor {
  constructor(private readonly scopeDocumentIds?: string[]) {}

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    logger.toolExecution(name, args);

    try {
      switch (name) {
        case "search_documents":
          return await this.searchDocuments(args);
        case "summarize_document":
          return await this.summarizeDocument(args);
        case "extract_entities":
          return await this.extractEntities(args);
        default:
          return { output: `Unknown tool: ${name}`, citations: [] };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Tool execution failed", { name, error: message });
      return {
        output: `Tool "${name}" failed: ${message}. Use search_documents or a document UUID from the catalog.`,
        citations: [],
      };
    }
  }

  private async resolveDoc(reference: unknown): Promise<Document | null> {
    return resolveDocumentForTool(
      reference != null ? String(reference) : undefined,
      this.scopeDocumentIds,
    );
  }

  private async searchDocuments(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = String(args.query ?? "");
    const topK = typeof args.top_k === "number" ? args.top_k : undefined;

    const result = await retrievalService.search(query, { topK });
    const output =
      result.chunks.length === 0
        ? "No relevant documents found."
        : result.context;

    return { output, citations: result.citations };
  }

  private async summarizeDocument(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const doc = await this.resolveDoc(args.document_id);
    if (!doc) {
      const hint = String(args.document_id ?? "latest");
      return {
        output: `Document not found for "${hint}". Use search_documents or pick a document id from the catalog.`,
        citations: [],
      };
    }

    const chunks = await chunkRepository.findByDocumentId(doc.id);
    if (chunks.length === 0) {
      return { output: `Document "${doc.name}" has no indexed content.`, citations: [] };
    }

    const fullText = chunks.map((c) => c.content).join("\n\n");
    const response = await getLlmGateway().generateResponse({
      messages: [
        {
          role: "system",
          content:
            "Summarize the following document concisely. Include key topics, findings, and structure.",
        },
        { role: "user", content: fullText.slice(0, 120_000) },
      ],
      temperature: 0.3,
    });

    const citations: Citation[] = [
      {
        documentId: doc.id,
        documentName: doc.name,
        chunkIndex: 0,
        excerpt: chunks[0]?.content.slice(0, 200),
      },
    ];

    return { output: response.content, citations };
  }

  private async extractEntities(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const doc = await this.resolveDoc(args.document_id);
    if (!doc) {
      const hint = String(args.document_id ?? "latest");
      return {
        output: `Document not found for "${hint}". Use search_documents or pick a document id from the catalog.`,
        citations: [],
      };
    }

    const chunks = await chunkRepository.findByDocumentId(doc.id);
    if (chunks.length === 0) {
      return { output: `Document "${doc.name}" has no indexed content.`, citations: [] };
    }

    const sample = chunks
      .slice(0, 10)
      .map((c) => c.content)
      .join("\n\n");

    const response = await getLlmGateway().generateResponse({
      messages: [
        {
          role: "system",
          content:
            "Extract named entities from the text. Return JSON with keys: people, organizations, dates, locations, concepts (arrays of strings).",
        },
        { role: "user", content: sample.slice(0, 80_000) },
      ],
      temperature: 0.1,
    });

    const citations: Citation[] = chunks.slice(0, 3).map((c) => ({
      documentId: doc.id,
      documentName: doc.name,
      chunkIndex: c.chunk_index,
      chunkId: c.id,
      excerpt: c.content.slice(0, 150),
    }));

    return { output: response.content, citations };
  }
}

export function createToolExecutor(scopeDocumentIds?: string[]): ToolExecutor {
  return new ToolExecutor(scopeDocumentIds);
}
