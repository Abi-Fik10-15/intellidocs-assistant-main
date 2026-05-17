import type { Citation, LLMProvider } from "@/types/chat";
import { newId } from "@/store/chat-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: { message: string; code?: string };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiSuccess<T> | ApiErrorBody;
  if (!res.ok || !json.success) {
    const message = !json.success ? json.error.message : `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status, !json.success ? json.error.code : undefined);
  }
  return json.data;
}

export interface BackendDocument {
  id: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  mimeType: string;
  fileSize: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatApiResponse {
  answer: string;
  citations: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    chunkId?: string;
    excerpt?: string;
  }>;
  conversationId: string;
  messageId: string;
}

export function mapBackendCitation(c: ChatApiResponse["citations"][number]): Citation {
  return {
    id: newId(),
    documentId: c.documentId,
    documentName: c.documentName,
    chunk: c.chunkIndex,
    excerpt: c.excerpt,
  };
}

/** User-friendly text for ingestion/API failures shown in the sidebar. */
export function formatApiError(message: string): string {
  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("free_tier") ||
    (message.includes("429") && message.includes("generativelanguage"))
  ) {
    return (
      "Gemini free-tier limit hit. In backend/.env set GEMINI_MODEL=gemini-1.5-flash, enable billing at https://ai.google.dev/, or wait ~1 minute and retry."
    );
  }
  if (message.includes("429") || /quota|billing/i.test(message)) {
    return "API quota exceeded — check billing for your provider, then try again.";
  }
  if (message.length > 280) {
    return `${message.slice(0, 280)}…`;
  }
  return message;
}

export function formatIngestionError(message: string): string {
  if (message.includes("401") || /invalid.*api.*key/i.test(message)) {
    return "Invalid API key — check your provider keys in backend/.env";
  }
  return formatApiError(message);
}

export function mapDocumentStatus(
  status: BackendDocument["status"],
): "uploading" | "processing" | "ready" | "error" {
  switch (status) {
    case "ready":
      return "ready";
    case "failed":
      return "error";
    case "processing":
      return "processing";
    default:
      return "uploading";
  }
}

export interface ProviderStatus {
  id: LLMProvider;
  configured: boolean;
  active: boolean;
}

export interface AppSettings {
  llmProvider: LLMProvider;
  defaultProvider: LLMProvider;
  providers: ProviderStatus[];
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, { cache: "no-store" });
  return parseResponse<AppSettings>(res);
}

export async function updateLlmProvider(provider: LLMProvider): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings/llm-provider`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  return parseResponse<AppSettings>(res);
}

export async function fetchDocuments(): Promise<BackendDocument[]> {
  const res = await fetch(`${API_BASE}/api/documents`, { cache: "no-store" });
  const data = await parseResponse<{ documents: BackendDocument[] }>(res);
  return data.documents;
}

export async function fetchDocument(id: string): Promise<BackendDocument> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { cache: "no-store" });
  return parseResponse<BackendDocument>(res);
}

export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<BackendDocument> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiSuccess<BackendDocument> | ApiErrorBody;
        if (xhr.status >= 400 || !json.success) {
          reject(
            new ApiClientError(
              !json.success ? json.error.message : `Upload failed (${xhr.status})`,
              xhr.status,
            ),
          );
          return;
        }
        resolve(json.data);
      } catch {
        reject(new ApiClientError("Invalid upload response"));
      }
    });

    xhr.addEventListener("error", () => reject(new ApiClientError("Upload network error")));
    xhr.open("POST", `${API_BASE}/api/upload`);
    xhr.send(form);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { method: "DELETE" });
  await parseResponse<{ id: string; deleted: boolean }>(res);
}

export async function reingestDocument(id: string): Promise<BackendDocument> {
  const res = await fetch(`${API_BASE}/api/documents/${id}/reingest`, { method: "POST" });
  return parseResponse<BackendDocument>(res);
}

export async function pollDocumentUntilReady(
  id: string,
  onStatus?: (doc: BackendDocument) => void,
  maxAttempts = 60,
  intervalMs = 2000,
): Promise<BackendDocument> {
  for (let i = 0; i < maxAttempts; i++) {
    const doc = await fetchDocument(id);
    onStatus?.(doc);
    if (doc.status === "ready" || doc.status === "failed") return doc;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new ApiClientError("Document processing timed out. Try again in a moment.");
}

export async function sendChat(params: {
  message: string;
  conversationId?: string;
  documentIds?: string[];
}): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseResponse<ChatApiResponse>(res);
}

/** Typing effect for a completed answer (streaming-ready UI). */
export async function* streamText(
  text: string,
): AsyncGenerator<{ delta?: string; done?: boolean }> {
  const tokens = text.match(/(\s+|[^\s]+)/g) ?? [text];
  for (const t of tokens) {
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 20));
    yield { delta: t };
  }
  yield { done: true };
}
