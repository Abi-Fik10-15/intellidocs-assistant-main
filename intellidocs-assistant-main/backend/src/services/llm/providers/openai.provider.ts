import OpenAI from "openai";
import { env } from "../../../config/index.js";
import { LLMProviderConfigError } from "../errors.js";
import { parseStructuredJson } from "../utils.js";
import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  ILLMProvider,
  ToolCall,
  ToolCallResult,
  TokenUsage,
} from "./types.js";

/**
 * OpenAI adapter — chat completions, embeddings, and function calling.
 */
export class OpenAIProvider implements ILLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY?.trim()) {
      throw new LLMProviderConfigError(
        "OPENAI_API_KEY is required when LLM_PROVIDER=openai. Add it to backend/.env",
        "openai",
      );
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts,
    });
    return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const tools = options.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      response_format:
        options.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    const choice = response.choices[0];
    const message = choice.message;

    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const content = message.content ?? "";
    const usage = mapOpenAIUsage(response.usage);

    return {
      content,
      toolCalls,
      finishReason: choice.finish_reason ?? "stop",
      usage,
      structured:
        options.responseFormat === "json" ? parseStructuredJson(content) : undefined,
    };
  }

  async callTools(
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult> {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    for (const tr of toolResults) {
      openaiMessages.push({
        role: "tool",
        tool_call_id: tr.toolCallId,
        content: tr.content,
      });
    }

    const response = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: openaiMessages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
      response_format:
        options?.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    const choice = response.choices[0];
    const content = choice.message.content ?? "";

    return {
      content,
      finishReason: choice.finish_reason ?? "stop",
      usage: mapOpenAIUsage(response.usage),
      structured:
        options?.responseFormat === "json" ? parseStructuredJson(content) : undefined,
    };
  }

  async *generateResponseStream(
    options: import("./types.js").StreamGenerateOptions,
  ): AsyncGenerator<import("./types.js").StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        options.onChunk?.({ delta, done: false });
        yield { delta, done: false };
      }
    }
    yield { delta: "", done: true };
  }
}

function mapOpenAIUsage(
  usage: OpenAI.Completions.CompletionUsage | undefined,
): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}
