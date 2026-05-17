"use client";

import { Moon, Plus, Sparkles, Sun, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/store/chat-store";
import { ConversationList } from "@/components/conversation-list";
import { DocumentCard } from "@/components/document-card";
import { UploadZone } from "@/components/upload-zone";
import { SettingsModal } from "@/components/settings-modal";
import { useDocumentUpload } from "@/hooks/use-document-upload";

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    documents,
    theme,
    newConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    toggleTheme,
    toggleSidebar,
  } = useChatStore();

  const { uploadFiles, removeUploadedDocument, reingest } = useDocumentUpload();

  return (
    <aside className="flex h-full w-[min(100vw,20rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar sm:w-80 lg:w-96">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-soft">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-sidebar-foreground">DocuMind</div>
            <div className="text-[10px] text-muted-foreground">AI document Q&amp;A</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground md:hidden"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Button onClick={() => newConversation()} className="w-full justify-start gap-2 rounded-lg" size="sm">
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-2 py-3">
          <section>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conversations
            </div>
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={selectConversation}
              onRename={renameConversation}
              onDelete={deleteConversation}
            />
          </section>

          <section>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Documents
            </div>
            <div className="px-1 pb-2">
              <UploadZone onFiles={uploadFiles} />
            </div>
            <div className="space-y-1.5 px-1">
              {documents.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Upload PDF, TXT, or Markdown to get started
                </p>
              ) : (
                documents.map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    onRemove={removeUploadedDocument}
                    onReingest={reingest}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      <div className="space-y-0.5 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <SettingsModal />
      </div>
    </aside>
  );
}
