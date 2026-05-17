export type Role = "user" | "assistant";

export interface Citation {
  id: string;
  documentId: string;
  documentName: string;
  chunk: number;
  excerpt?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  citations?: Citation[];
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  /** Server-side conversation UUID (set after first message). */
  backendId?: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

export type DocStatus = "uploading" | "processing" | "ready" | "error";

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  status: DocStatus;
  progress: number;
  uploadedAt: number;
  errorMessage?: string;
}

export type LLMProvider = "openai" | "claude" | "gemini";
export type Theme = "light" | "dark";
