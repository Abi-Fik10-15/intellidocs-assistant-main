/**
 * LLM Gateway — the only surface application services should use for LLM calls.
 *
 * Why a gateway?
 * - Hides vendor SDKs (OpenAI, Anthropic, Gemini) behind ILLMProvider
 * - Centralizes logging, timeouts, and error normalization
 * - Provider switching is env-only (LLM_PROVIDER) via factory.ts
 *
 * Streaming: providers may implement generateResponseStream; the gateway
 * delegates when available so HTTP handlers can adopt streaming incrementally.
 */
import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { createLLMProvider } from "./factory.js";
import { LLMError } from "./errors.js";
import type { ILLMProvider } from "./providers/types.js";
import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  StreamGenerateOptions,
  ToolCallResult,
} from "./providers/types.js";
import { withTimeout } from "./utils.js";
import type { LLMProviderName } from "./providers/types.js";

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || /quota|billing/i.test(msg);
}

/** When OpenAI quota is exhausted but Gemini is configured, retry once with Gemini. */
function quotaFallbackProvider(current: LLMProviderName): LLMProviderName | null {
  if (current === "openai" && env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

function wrapProviderError(err: unknown, provider: ILLMProvider["name"]): Error {
  if (err instanceof LLMError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new LLMError(message, provider, err);
}

export class LLMGateway {
  private readonly defaultTimeoutMs: number;

  constructor(
    private provider: ILLMProvider,
    defaultTimeoutMs?: number,
  ) {
    this.defaultTimeoutMs = defaultTimeoutMs ?? env.LLM_REQUEST_TIMEOUT_MS;
  }

  get providerName(): ILLMProvider["name"] {
    return this.provider.name;
  }

  /** Replace the active provider at runtime (e.g. tests). */
  setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /** Rebuild provider from env or an explicit name. */
  switchProvider(name?: ILLMProvider["name"]): void {
    this.provider = createLLMProvider(name);
    logger.info("LLM provider switched", { provider: this.provider.name });
  }

  async createEmbedding(text: string, timeoutMs?: number): Promise<number[]> {
    const start = Date.now();
    logger.info("LLM createEmbedding", { provider: this.provider.name });

    try {
      const vector = await withTimeout(
        this.provider.createEmbedding(text),
        timeoutMs ?? this.defaultTimeoutMs,
        this.provider.name,
      );
      logger.info("LLM createEmbedding complete", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        dimensions: vector.length,
      });
      return vector;
    } catch (err) {
      logger.error("LLM createEmbedding failed", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw wrapProviderError(err, this.provider.name);
    }
  }

  async createEmbeddings(texts: string[], timeoutMs?: number): Promise<number[][]> {
    const start = Date.now();
    logger.info("LLM createEmbeddings", {
      provider: this.provider.name,
      count: texts.length,
    });

    try {
      const vectors = await withTimeout(
        this.provider.createEmbeddings(texts),
        timeoutMs ?? this.defaultTimeoutMs,
        this.provider.name,
      );
      logger.info("LLM createEmbeddings complete", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        count: vectors.length,
      });
      return vectors;
    } catch (err) {
      logger.error("LLM createEmbeddings failed", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw wrapProviderError(err, this.provider.name);
    }
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const start = Date.now();
    const toolNames = options.tools?.map((t) => t.name);

    logger.info("LLM generateResponse", {
      provider: this.provider.name,
      messageCount: options.messages.length,
      tools: toolNames,
      responseFormat: options.responseFormat ?? "text",
    });

    try {
      const result = await withTimeout(
        this.provider.generateResponse(options),
        options.timeoutMs ?? this.defaultTimeoutMs,
        this.provider.name,
      );

      logger.info("LLM generateResponse complete", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        finishReason: result.finishReason,
        toolCallCount: result.toolCalls?.length ?? 0,
        toolCalls: result.toolCalls?.map((t) => t.name),
        usage: result.usage,
        contentLength: result.content.length,
      });

      return result;
    } catch (err) {
      const fallback = quotaFallbackProvider(this.provider.name);
      if (fallback && isQuotaError(err)) {
        logger.warn("LLM quota exceeded — falling back to alternate provider", {
          from: this.provider.name,
          to: fallback,
        });
        this.switchProvider(fallback);
        return this.generateResponse(options);
      }
      logger.error("LLM generateResponse failed", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw wrapProviderError(err, this.provider.name);
    }
  }

  async callTools(
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult> {
    const start = Date.now();

    logger.info("LLM callTools", {
      provider: this.provider.name,
      toolResultCount: toolResults.length,
      tools: toolResults.map((t) => t.name),
    });

    try {
      const result = await withTimeout(
        this.provider.callTools(messages, toolResults, options),
        options?.timeoutMs ?? this.defaultTimeoutMs,
        this.provider.name,
      );

      logger.info("LLM callTools complete", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        usage: result.usage,
        contentLength: result.content.length,
      });

      return result;
    } catch (err) {
      const fallback = quotaFallbackProvider(this.provider.name);
      if (fallback && isQuotaError(err)) {
        logger.warn("LLM quota exceeded on callTools — falling back", {
          from: this.provider.name,
          to: fallback,
        });
        this.switchProvider(fallback);
        return this.callTools(messages, toolResults, options);
      }
      logger.error("LLM callTools failed", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw wrapProviderError(err, this.provider.name);
    }
  }

  /**
   * Streaming entry point — delegates to provider when implemented.
   * Throws if the active provider does not support streaming yet.
   */
  async *generateResponseStream(
    options: StreamGenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!this.provider.generateResponseStream) {
      throw new LLMError(
        `Provider "${this.provider.name}" does not implement streaming yet`,
        this.provider.name,
      );
    }

    logger.info("LLM generateResponseStream", { provider: this.provider.name });
    const start = Date.now();

    try {
      for await (const chunk of this.provider.generateResponseStream(options)) {
        options.onChunk?.(chunk);
        yield chunk;
      }
      logger.info("LLM generateResponseStream complete", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      logger.error("LLM generateResponseStream failed", {
        provider: this.provider.name,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw wrapProviderError(err, this.provider.name);
    }
  }
}

/** Factory helper — preferred for DI in tests (inject a mock ILLMProvider). */
export function createLLMGateway(provider?: ILLMProvider): LLMGateway {
  return new LLMGateway(provider ?? createLLMProvider());
}

let gatewayInstance: LLMGateway | undefined;

/** Singleton gateway; lazy init so dotenv loads before provider construction. */
export function getLlmGateway(): LLMGateway {
  if (!gatewayInstance) {
    gatewayInstance = createLLMGateway();
    logger.info("LLM gateway initialized", { provider: gatewayInstance.providerName });
  }
  return gatewayInstance;
}
