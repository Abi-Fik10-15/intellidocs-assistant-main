"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  ApiClientError,
  deleteDocument,
  formatIngestionError,
  mapDocumentStatus,
  pollDocumentUntilReady,
  reingestDocument,
  uploadDocument,
} from "@/lib/api";
import { filterUploadFiles } from "@/lib/upload";
import { useChatStore } from "@/store/chat-store";

export function useDocumentUpload() {
  const addDocument = useChatStore((s) => s.addDocument);
  const updateDocument = useChatStore((s) => s.updateDocument);
  const removeDocument = useChatStore((s) => s.removeDocument);

  const watchIngestion = useCallback(
    async (documentId: string) => {
      updateDocument(documentId, {
        status: "processing",
        progress: 30,
        errorMessage: undefined,
      });
      const final = await pollDocumentUntilReady(documentId, (doc) => {
        updateDocument(documentId, {
          status: mapDocumentStatus(doc.status),
          progress: doc.status === "ready" ? 100 : doc.status === "processing" ? 60 : 30,
          errorMessage: doc.errorMessage ? formatIngestionError(doc.errorMessage) : undefined,
        });
      });
      updateDocument(documentId, {
        status: mapDocumentStatus(final.status),
        progress: final.status === "ready" ? 100 : 0,
        errorMessage: final.errorMessage ? formatIngestionError(final.errorMessage) : undefined,
      });
      if (final.status === "ready") {
        toast.success("Document ready", { description: final.name });
      } else if (final.status === "failed") {
        toast.error("Document processing failed", {
          description: final.errorMessage ? formatIngestionError(final.errorMessage) : undefined,
        });
      }
    },
    [updateDocument],
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      const accepted = filterUploadFiles(files);
      if (accepted.length === 0) {
        toast.error("Unsupported file type", {
          description: "Upload PDF, TXT, or Markdown (.md) files only.",
        });
        return;
      }
      if (accepted.length < files.length) {
        toast.message("Some files were skipped", {
          description: "Only PDF, TXT, and MD files are supported.",
        });
      }

      for (const file of accepted) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        addDocument({
          id: tempId,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "uploading",
          progress: 0,
          uploadedAt: Date.now(),
        });

        void (async () => {
          try {
            const uploaded = await uploadDocument(file, (p) =>
              updateDocument(tempId, { progress: p, status: "uploading" }),
            );

            updateDocument(tempId, {
              id: uploaded.id,
              name: uploaded.name,
              size: uploaded.fileSize,
              type: uploaded.mimeType,
              status: mapDocumentStatus(uploaded.status),
              progress: 100,
            });

            await watchIngestion(uploaded.id);
          } catch (err) {
            const message = err instanceof ApiClientError ? err.message : "Upload failed";
            updateDocument(tempId, {
              status: "error",
              progress: 0,
              errorMessage: formatIngestionError(message),
            });
            toast.error("Upload failed", { description: formatIngestionError(message) });
          }
        })();
      }
    },
    [addDocument, updateDocument, watchIngestion],
  );

  const removeUploadedDocument = useCallback(
    async (id: string) => {
      if (id.startsWith("temp-")) {
        removeDocument(id);
        return;
      }
      try {
        await deleteDocument(id);
        removeDocument(id);
        toast.success("Document deleted");
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Could not delete document";
        toast.error("Delete failed", { description: message });
      }
    },
    [removeDocument],
  );

  const reingest = useCallback(
    async (documentId: string) => {
      try {
        await reingestDocument(documentId);
        await watchIngestion(documentId);
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Re-ingest failed";
        updateDocument(documentId, {
          status: "error",
          errorMessage: formatIngestionError(message),
        });
        toast.error("Re-ingest failed", { description: formatIngestionError(message) });
      }
    },
    [updateDocument, watchIngestion],
  );

  return { uploadFiles, removeUploadedDocument, reingest };
}
