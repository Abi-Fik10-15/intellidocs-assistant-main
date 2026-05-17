export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface Document {
  id: string;
  name: string;
  mime_type: string;
  file_path: string;
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  created_at: Date;
}

export interface ChunkWithScore extends Chunk {
  document_name: string;
  similarity: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[] | null;
  created_at: Date;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  chunkId?: string;
  excerpt?: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  conversationId: string;
  messageId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Re-exported from LLM abstraction — use services/llm for new code. */
export type {
  LLMProviderName,
  LLMMessage,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  ToolCallResult,
  GenerateOptions,
  GenerateResult,
  TokenUsage,
  StreamChunk,
  ResponseFormat,
} from "../services/llm/providers/types.js";
