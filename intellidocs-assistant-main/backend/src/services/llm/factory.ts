/**
 * LLM provider factory — reads LLM_PROVIDER from the environment and returns
 * the matching adapter. To add a provider: implement ILLMProvider, add a file
 * under providers/, and register it in PROVIDER_REGISTRY below.
 */
import { env } from "../../config/index.js";
import { LLMProviderNotFoundError } from "./errors.js";
import { ClaudeProvider } from "./providers/claude.provider.js";
import { GeminiProvider } from "./providers/gemini.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import type { ILLMProvider, LLMProviderName } from "./providers/types.js";

type ProviderFactory = () => ILLMProvider;

/** Extend this map when adding new vendors — no other wiring required. */
const PROVIDER_REGISTRY: Record<LLMProviderName, ProviderFactory> = {
  openai: () => new OpenAIProvider(),
  claude: () => new ClaudeProvider(),
  gemini: () => new GeminiProvider(),
};

export function getSupportedLLMProviders(): LLMProviderName[] {
  return Object.keys(PROVIDER_REGISTRY) as LLMProviderName[];
}

/**
 * Instantiates the provider for `name` or env.LLM_PROVIDER (default openai).
 * Switching vendors: set LLM_PROVIDER=claude — business code stays unchanged.
 */
export function createLLMProvider(name?: LLMProviderName): ILLMProvider {
  const providerName = name ?? env.LLM_PROVIDER;
  const factory = PROVIDER_REGISTRY[providerName];

  if (!factory) {
    throw new LLMProviderNotFoundError(String(providerName));
  }

  return factory();
}
