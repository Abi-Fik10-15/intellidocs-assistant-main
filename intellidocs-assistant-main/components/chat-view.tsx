"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftOpen, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ChatEmpty } from "@/components/chat-empty";
import { useChatStore, newId } from "@/store/chat-store";
import {
  ApiClientError,
  formatApiError,
  mapBackendCitation,
  sendChat,
  streamText,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDocumentUpload } from "@/hooks/use-document-upload";

export function ChatView() {
  const {
    conversations,
    activeConversationId,
    documents,
    appendMessage,
    updateMessage,
    removeMessage,
    sidebarOpen,
    toggleSidebar,
    provider,
    setConversationBackendId,
  } = useChatStore();

  const convo = conversations.find((c) => c.id === activeConversationId);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<{ cancelled: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readyDocumentIds = documents.filter((d) => d.status === "ready").map((d) => d.id);
  const { uploadFiles } = useDocumentUpload();

  const handleAttach = (files: File[]) => {
    uploadFiles(files);
    if (!sidebarOpen) toggleSidebar();
  };

  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convo?.messages, streaming]);

  const runAssistant = useCallback(
    async (prompt: string, convoId: string) => {
      const assistantId = newId();
      appendMessage(convoId, {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        streaming: true,
      });
      setStreaming(true);
      const token = { cancelled: false };
      abortRef.current = token;

      const currentConvo = useChatStore.getState().conversations.find((c) => c.id === convoId);

      if (readyDocumentIds.length === 0) {
        updateMessage(convoId, assistantId, {
          content:
            "No indexed documents are ready yet. Upload a PDF, TXT, or Markdown file and wait until its status shows **ready**, then ask your question again.",
          streaming: false,
        });
        setStreaming(false);
        abortRef.current = null;
        return;
      }

      let buffer = "";
      try {
        const result = await sendChat({
          message: prompt,
          conversationId: currentConvo?.backendId,
          documentIds: readyDocumentIds,
        });

        if (token.cancelled) return;

        setConversationBackendId(convoId, result.conversationId);

        for await (const chunk of streamText(result.answer)) {
          if (token.cancelled) break;
          if (chunk.delta) {
            buffer += chunk.delta;
            updateMessage(convoId, assistantId, { content: buffer });
          }
        }

        updateMessage(convoId, assistantId, {
          citations: result.citations.map(mapBackendCitation),
        });
      } catch (err) {
        const raw =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Something went wrong. Is the backend running on port 4000?";
        const message = formatApiError(raw);
        updateMessage(convoId, assistantId, {
          content: `**Error:** ${message}`,
        });
      } finally {
        updateMessage(convoId, assistantId, { streaming: false });
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      appendMessage,
      updateMessage,
      readyDocumentIds,
      setConversationBackendId,
    ],
  );

  const handleSend = (text: string) => {
    if (!convo) return;
    appendMessage(convo.id, {
      id: newId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    });
    void runAssistant(text, convo.id);
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.cancelled = true;
  };

  const handleRegenerate = (assistantMsgId: string) => {
    if (!convo) return;
    const idx = convo.messages.findIndex((m) => m.id === assistantMsgId);
    const userMsg = [...convo.messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    removeMessage(convo.id, assistantMsgId);
    void runAssistant(userMsg.content, convo.id);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-12 items-center gap-2 border-b border-border px-3">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-sm font-medium text-foreground">{convo?.title ?? "New conversation"}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="capitalize">{provider}</span>
          <span
            className={`ml-1 h-1.5 w-1.5 rounded-full ${readyDocumentIds.length > 0 ? "bg-emerald-500" : "bg-amber-500"}`}
            title={readyDocumentIds.length > 0 ? "Documents indexed" : "No documents ready"}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea ref={scrollRef} className="flex-1">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {!convo || convo.messages.length === 0 ? (
              <ChatEmpty onPick={handleSend} documents={documents} />
            ) : (
              <div className="space-y-6">
                {convo.messages.map((m, i) => {
                  const isLastAssistant = m.role === "assistant" && i === convo.messages.length - 1 && !m.streaming;
                  return (
                    <ChatMessage
                      key={m.id}
                      message={m}
                      onRegenerate={isLastAssistant ? () => handleRegenerate(m.id) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <ChatInput
          onSend={handleSend}
          isStreaming={streaming}
          onStop={handleStop}
          onFiles={handleAttach}
        />
      </div>
    </div>
  );
}
