import type { ToolDefinition } from "../../types/index.js";

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "search_documents",
    description:
      "Search indexed documents using semantic similarity. Returns relevant text chunks with document metadata.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query describing what information to find",
        },
        top_k: {
          type: "number",
          description: "Number of chunks to retrieve (default 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "summarize_document",
    description:
      "Generate a structured summary of a specific document by its ID. Use when the user asks for an overview or summary.",
    parameters: {
      type: "object",
      properties: {
        document_id: {
          type: "string",
          description:
            'Catalog UUID, exact filename (e.g. "report.pdf"), or "latest" for the newest ready document',
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "extract_entities",
    description:
      "Extract named entities (people, organizations, dates, locations, key concepts) from a document.",
    parameters: {
      type: "object",
      properties: {
        document_id: {
          type: "string",
          description:
            'Catalog UUID, exact filename (e.g. "report.pdf"), or "latest" for the newest ready document',
        },
      },
      required: ["document_id"],
    },
  },
];
