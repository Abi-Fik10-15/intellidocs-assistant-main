"use client";

import { useEffect } from "react";
import { fetchDocuments, fetchSettings, formatIngestionError, mapDocumentStatus } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";
import { logger } from "@/lib/logger";

/** Loads indexed documents from the API on mount. */
export function AppBootstrap() {
  const setDocuments = useChatStore((s) => s.setDocuments);
  const setProvider = useChatStore((s) => s.setProvider);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchSettings();
        setProvider(settings.llmProvider);
      } catch (err) {
        logger.warn("Could not load settings from API", err);
      }
    })();
  }, [setProvider]);

  useEffect(() => {
    void (async () => {
      try {
        const docs = await fetchDocuments();
        setDocuments(
          docs.map((d) => ({
            id: d.id,
            name: d.name,
            size: d.fileSize,
            type: d.mimeType,
            status: mapDocumentStatus(d.status),
            progress: d.status === "ready" ? 100 : d.status === "processing" ? 50 : 10,
            uploadedAt: new Date(d.createdAt).getTime(),
            errorMessage: d.errorMessage ? formatIngestionError(d.errorMessage) : undefined,
          })),
        );
      } catch (err) {
        logger.warn("Could not load documents from API", err);
      }
    })();
  }, [setDocuments]);

  return null;
}
