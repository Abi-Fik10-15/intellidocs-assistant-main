import Anthropic from "@anthropic-ai/sdk";
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
  ToolDefinition,
} from "./types.js";

/**
 * Anthropic Claude adapter — messages API with tool_use blocks.
 * Embeddings delegate to OpenAI when OPENAI_API_KEY is configured.
 */
export class ClaudeProvider implements ILLMProvider {
  readonly name = "claude" as const;
  private client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY?.trim()) {
      throw new LLMProviderConfigError(
        "ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude. Add it to backend/.env",
        "claude",
      );
    }
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!env.OPENAI_API_KEY?.trim()) {
      throw new LLMProviderConfigError(
        "OPENAI_API_KEY required for embeddings when using Claude (or set EMBEDDING_PROVIDER=gemini|mock).",
        "claude",
      );
    }
    const { OpenAIProvider } = await import("./openai.provider.js");
    return new OpenAIProvider().createEmbedding(text);
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const { OpenAIProvider } = await import("./openai.provider.js");
    return new OpenAIProvider().createEmbeddings(texts);
  }

  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const system = options.messages.find((m) => m.role === "system")?.content ?? "";
    const nonSystem = options.messages.filter((m) => m.role !== "system");

    const tools = options.tools?.map((t: ToolDefinition) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? 4096,
      system,
      messages: nonSystem.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      tools,
      temperature: options.temperature ?? 0.2,
    });

    let content = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: response.stop_reason ?? "end_turn",
      usage: mapClaudeUsage(response.usage),
      structured:
        options.responseFormat === "json" ? parseStructuredJson(content) : undefined,
    };
  }

  async callTools(
    messages: ChatMessage[],
    toolResults: ToolCallResult[],
    options?: Omit<GenerateOptions, "messages" | "tools">,
  ): Promise<GenerateResult> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const userMessages = messages.filter((m) => m.role !== "system");

    const anthropicMessages: Anthropic.MessageParam[] = [
      ...userMessages.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.toolCallId,
          content: tr.content,
        })),
      },
    ];

    const response = await this.client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: options?.maxTokens ?? 4096,
      system,
      messages: anthropicMessages,
      temperature: options?.temperature ?? 0.2,
    });

    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      content,
      finishReason: response.stop_reason ?? "end_turn",
      usage: mapClaudeUsage(response.usage),
      structured:
        options?.responseFormat === "json" ? parseStructuredJson(content) : undefined,
    };
  }
}

function mapClaudeUsage(usage: Anthropic.Usage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    totalTokens: usage.input_tokens + usage.output_tokens,
  };
}
