import { env } from "../config/index.js";
import { AppError } from "../middleware/error.middleware.js";
import { getSupportedLLMProviders } from "./llm/factory.js";
import { getLlmGateway } from "./llm/gateway.js";
import { LLMProviderConfigError } from "./llm/errors.js";
import type { LLMProviderName } from "./llm/providers/types.js";

export interface ProviderStatus {
  id: LLMProviderName;
  configured: boolean;
  active: boolean;
}

export interface AppSettings {
  llmProvider: LLMProviderName;
  defaultProvider: LLMProviderName;
  providers: ProviderStatus[];
}

function isProviderConfigured(name: LLMProviderName): boolean {
  switch (name) {
    case "openai":
      return Boolean(env.OPENAI_API_KEY);
    case "claude":
      return Boolean(env.ANTHROPIC_API_KEY);
    case "gemini":
      return Boolean(env.GEMINI_API_KEY);
    default:
      return false;
  }
}

export function getAppSettings(): AppSettings {
  const llmProvider = getLlmGateway().providerName;
  const providers = getSupportedLLMProviders().map((id) => ({
    id,
    configured: isProviderConfigured(id),
    active: id === llmProvider,
  }));

  return {
    llmProvider,
    defaultProvider: env.LLM_PROVIDER,
    providers,
  };
}

export function setLlmProvider(name: LLMProviderName): AppSettings {
  if (!getSupportedLLMProviders().includes(name)) {
    throw new AppError(`Unknown LLM provider "${name}"`, 400, "INVALID_PROVIDER");
  }

  if (!isProviderConfigured(name)) {
    const keyHint =
      name === "openai"
        ? "OPENAI_API_KEY"
        : name === "claude"
          ? "ANTHROPIC_API_KEY"
          : "GEMINI_API_KEY";
    throw new AppError(
      `${keyHint} is not set in backend/.env. Add the key and restart, or choose another provider.`,
      400,
      "PROVIDER_NOT_CONFIGURED",
    );
  }

  try {
    getLlmGateway().switchProvider(name);
  } catch (err) {
    if (err instanceof LLMProviderConfigError) {
      throw new AppError(err.message, 400, "PROVIDER_NOT_CONFIGURED");
    }
    throw err;
  }
  return getAppSettings();
}
