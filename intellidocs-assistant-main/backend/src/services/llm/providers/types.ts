/**
 * LLM abstraction types — business logic depends on these interfaces only,
 * never on vendor SDKs (OpenAI, Anthropic, etc.).
 */

export type LLMProviderName = "openai" | "claude" | "gemini";

export type ChatMessageRole = "system" | "user" | "assistant";

/** Normalized chat message used by all providers. */
export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Result passed back to the model after a tool executes. */
export interface ToolCallResult {
  toolCallId: string;
  name: string;
  content: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type ResponseFormat = "text" | "json";

export interface GenerateOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** When "json", providers may enforce structured output where supported. */
  responseFormat?: ResponseFormat;
}

export interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
  usage?: TokenUsage;
  /** Parsed JSON when responseFormat is "json" and parsing succeeds. */
  structured?: Record<string, unknown>;
}

/** Chunk for future streaming implementations. */
export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface StreamGenerateOptions extends GenerateOptions {
  onChunk?: (chunk: StreamChunk) => void;
}

/**
 * Contract every LLM vendor adapter must implement.
 * Register new providers in factory.ts — no other files need to change.
 */
export interface ILLMProvider {
  readonly name: LLMProviderName;

  generateResponse(options: GenerateOptions): Promise<GenerateResult>;
  createEmbedding(text: string): Promise<number[]>;
  createEmbeddings(texts: string[]): Promise<number[][]>;
  callTools(
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult>;

  /**
   * Optional streaming entry point. Default: not implemented.
   * Gateway can delegate here when streaming is enabled.
   */
  generateResponseStream?(options: StreamGenerateOptions): AsyncGenerator<StreamChunk>;
}

// Backward-compatible aliases used elsewhere in the codebase
export type LLMMessage = ChatMessage;
export type { GenerateOptions as LegacyGenerateOptions, GenerateResult as LegacyGenerateResult };
