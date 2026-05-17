import { LLMTimeoutError } from "./errors.js";
import type { LLMProviderName } from "./providers/types.js";

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  provider: LLMProviderName,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LLMTimeoutError(provider, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export function parseStructuredJson(content: string): Record<string, unknown> | undefined {
  try {
    const trimmed = content.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return undefined;
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
