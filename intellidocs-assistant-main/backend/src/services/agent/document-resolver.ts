import { documentRepository } from "../../repositories/index.js";
import type { Document } from "../../types/index.js";

const LATEST_ALIASES = new Set([
  "latest",
  "most recent",
  "most_recent",
  "newest",
  "last",
]);

export async function resolveDocumentForTool(
  reference: string | undefined,
  scopeIds?: string[],
): Promise<Document | null> {
  const ref = (reference ?? "").trim();
  const scope = scopeIds?.length ? scopeIds : undefined;

  if (!ref || LATEST_ALIASES.has(ref.toLowerCase())) {
    return documentRepository.findLatestReady(scope);
  }

  return documentRepository.resolveReference(ref, {
    scopeIds: scope,
    readyOnly: true,
  });
}
