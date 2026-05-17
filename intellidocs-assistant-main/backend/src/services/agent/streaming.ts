import type { ChatResponse } from "../../types/index.js";

/**
 * Future streaming extension point.
 * Implement AsyncGenerator<StreamChunk> for SSE/WebSocket delivery.
 */
export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | { type: "citation"; citation: ChatResponse["citations"][number] }
  | { type: "done"; response: ChatResponse };

export interface StreamingChatService {
  chatStream(
    userMessage: string,
    conversationId?: string,
    documentIds?: string[],
  ): AsyncGenerator<ChatStreamEvent>;
}
