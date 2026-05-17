import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../../config/index.js";
import { logger } from "../../../utils/logger.js";
import { LLMProviderConfigError } from "../errors.js";
import { parseStructuredJson } from "../utils.js";
import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  ILLMProvider,
  ToolCall,
  ToolCallResult,
  ToolDefinition,
} from "./types.js";

/**
 * Fallback models for chat (generateContent).
 * Avoid gemini-2.5-flash on free tier — very low daily request cap (often 20/day).
 */
const FALLBACK_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

function jsonSchemaToGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return schema;

  const properties: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) {
    const typeStr = String(val.type ?? "string").toLowerCase();
    const geminiType =
      typeStr === "integer" || typeStr === "number"
        ? Type.NUMBER
        : typeStr === "boolean"
          ? Type.BOOLEAN
          : typeStr === "array"
            ? Type.ARRAY
            : typeStr === "object"
              ? Type.OBJECT
              : Type.STRING;
    properties[key] = {
      type: geminiType,
      description: val.description,
    };
  }

  return {
    type: Type.OBJECT,
    properties,
    required: schema.required as string[] | undefined,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isQuotaError(err: unknown): boolean {
  const msg = errorMessage(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("free_tier")
  );
}

function isModelNotFoundError(err: unknown): boolean {
  const msg = errorMessage(err);
  return (
    msg.includes("NOT_FOUND") ||
    msg.includes("is not found") ||
    msg.includes('"code":404') ||
    msg.includes("404")
  );
}

function isRetryableGeminiError(err: unknown): boolean {
  return isQuotaError(err) || isModelNotFoundError(err);
}

function parseRetrySeconds(err: unknown): number | undefined {
  const m = errorMessage(err).match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return m ? Math.ceil(Number(m[1])) : undefined;
}

function formatGeminiQuotaError(lastError: unknown): Error {
  const secs = parseRetrySeconds(lastError);
  const hint = secs
    ? `Gemini free-tier limit hit. Wait about ${secs} seconds, or set GEMINI_MODEL=gemini-2.0-flash-lite in backend/.env.`
    : "Gemini free-tier limit hit. Set GEMINI_MODEL=gemini-2.0-flash-lite in backend/.env or enable billing at https://ai.google.dev/";
  return new Error(hint);
}

function modelsToTry(): string[] {
  const primary = env.GEMINI_MODEL;
  const rest = FALLBACK_MODELS.filter((m) => m !== primary);
  return [primary, ...rest];
}

/** Google Gemini adapter — register in factory.ts to enable LLM_PROVIDER=gemini. */
export class GeminiProvider implements ILLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenAI;

  constructor() {
    if (!env.GEMINI_API_KEY?.trim()) {
      throw new LLMProviderConfigError(
        "GEMINI_API_KEY is required when LLM_PROVIDER=gemini. Add it to backend/.env",
        "gemini",
      );
    }
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents: text,
      config: {
        outputDimensionality: env.EMBEDDING_DIMENSIONS,
      },
    });
    const values = response.embeddings?.[0]?.values;
    if (!values?.length) {
      throw new Error("Gemini returned empty embedding");
    }
    return values;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.createEmbedding(text));
    }
    return embeddings;
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    return this.withModelFallback(
      (model) => this.generateWithModel(model, options),
      "generateContent",
    );
  }

  private async generateWithModel(
    model: string,
    options: GenerateOptions,
  ): Promise<GenerateResult> {
    const system = options.messages.find((m) => m.role === "system")?.content;
    const conversation = options.messages.filter((m) => m.role !== "system");

    const contents = conversation.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const tools = options.tools?.length
      ? [
          {
            functionDeclarations: options.tools.map((t: ToolDefinition) => ({
              name: t.name,
              description: t.description,
              parameters: jsonSchemaToGemini(t.parameters),
            })),
          },
        ]
      : undefined;

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: system,
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 4096,
        tools,
      },
    });

    const content = response.text ?? "";
    const toolCalls: ToolCall[] = [];

    const calls = response.functionCalls ?? [];
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      if (!call.name) continue;
      toolCalls.push({
        id: `gemini-call-${i}`,
        name: call.name,
        arguments: (call.args ?? {}) as Record<string, unknown>,
      });
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
      structured:
        options.responseFormat === "json" ? parseStructuredJson(content) : undefined,
    };
  }

  async callTools(
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult> {
    return this.withModelFallback(
      (model) => this.callToolsWithModel(model, messages, toolResults, options),
      "callTools",
    );
  }

  private async callToolsWithModel(
    model: string,
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const conversation = messages.filter((m) => m.role !== "system");

    const contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> =
      conversation.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    for (const tr of toolResults) {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: tr.name,
              response: { result: tr.content },
            },
          },
        ],
      });
    }

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: system,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    });

    const text = response.text ?? "";
    return {
      content: text,
      finishReason: "stop",
      structured:
        options?.responseFormat === "json" ? parseStructuredJson(text) : undefined,
    };
  }

  private async withModelFallback<T>(
    fn: (model: string) => Promise<T>,
    operation: string,
  ): Promise<T> {
    const models = modelsToTry();
    let lastError: unknown;

    for (const model of models) {
      try {
        if (model !== env.GEMINI_MODEL) {
          logger.warn(`Gemini ${operation}: retrying with fallback model ${model}`);
        }
        return await fn(model);
      } catch (err) {
        lastError = err;
        if (!isRetryableGeminiError(err)) throw err;
        logger.warn(`Gemini ${operation} failed on ${model}`, {
          error: errorMessage(err).slice(0, 200),
          retryable: isModelNotFoundError(err) ? "model_not_found" : "quota",
        });
      }
    }

    if (lastError && isQuotaError(lastError)) {
      throw formatGeminiQuotaError(lastError);
    }
    throw lastError;
  }
}
