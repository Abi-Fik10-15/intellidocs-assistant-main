import type { LLMProviderName } from "./providers/types.js";

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider?: LLMProviderName,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMProviderNotFoundError extends LLMError {
  constructor(provider: string) {
    super(
      `Unknown LLM provider "${provider}". Set LLM_PROVIDER to one of: openai, claude, gemini.`,
      undefined,
    );
    this.name = "LLMProviderNotFoundError";
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: LLMProviderName, timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`, provider);
    this.name = "LLMTimeoutError";
  }
}

export class LLMProviderConfigError extends LLMError {
  constructor(message: string, provider: LLMProviderName) {
    super(message, provider);
    this.name = "LLMProviderConfigError";
  }
}
