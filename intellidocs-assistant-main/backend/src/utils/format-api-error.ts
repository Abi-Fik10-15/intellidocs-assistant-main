/** Turn provider JSON errors into short user-facing messages. */
export function formatProviderError(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed.error?.message) {
      return formatProviderError(parsed.error.message);
    }
  } catch {
    /* plain text */
  }

  if (
    message.includes("is not found") ||
    (message.includes("NOT_FOUND") && message.includes("models/gemini"))
  ) {
    return (
      "Gemini model not available. Set GEMINI_MODEL=gemini-2.0-flash-lite in backend/.env and restart the server."
    );
  }

  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("free_tier") ||
    (message.includes("429") && message.includes("generativelanguage"))
  ) {
    const retry = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
    const wait = retry ? ` Wait about ${Math.ceil(Number(retry[1]))} seconds, or` : "";
    return (
      `Gemini free-tier quota exceeded for this model.${wait} Set GEMINI_MODEL=gemini-2.0-flash-lite in backend/.env, ` +
      "enable billing at https://ai.google.dev/, or use EMBEDDING_PROVIDER=mock for local dev."
    );
  }
  if (message.includes("429") || /quota|billing/i.test(message)) {
    if (/embedding/i.test(message) || message.includes("text-embedding")) {
      return (
        "OpenAI embedding quota exceeded. Set EMBEDDING_PROVIDER=gemini or mock in backend/.env " +
        "(keep LLM_PROVIDER=openai for chat), restart the server, and try again."
      );
    }
    return (
      "API quota exceeded. Set LLM_PROVIDER=gemini in backend/.env (you have GEMINI_API_KEY), " +
      "restart the server, or add billing at https://platform.openai.com/account/billing."
    );
  }
  if (message.length > 280) {
    return `${message.slice(0, 280)}…`;
  }
  return message;
}
