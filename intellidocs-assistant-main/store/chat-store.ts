import { create } from "zustand";
import type { Conversation, Message, UploadedDocument, LLMProvider, Theme } from "@/types/chat";

const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 10);

const defaultConvo: Conversation = {
  id: uid(),
  title: "New conversation",
  updatedAt: now(),
  messages: [],
};

interface ChatState {
  theme: Theme;
  provider: LLMProvider;
  conversations: Conversation[];
  documents: UploadedDocument[];
  activeConversationId: string;
  sidebarOpen: boolean;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setProvider: (p: LLMProvider) => void;
  toggleSidebar: () => void;

  newConversation: () => string;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;

  appendMessage: (convoId: string, msg: Message) => void;
  updateMessage: (convoId: string, msgId: string, patch: Partial<Message>) => void;
  removeMessage: (convoId: string, msgId: string) => void;

  addDocument: (doc: UploadedDocument) => void;
  updateDocument: (id: string, patch: Partial<UploadedDocument>) => void;
  removeDocument: (id: string) => void;
  setDocuments: (docs: UploadedDocument[]) => void;
  setConversationBackendId: (convoId: string, backendId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  theme: "light",
  provider: "openai",
  conversations: [defaultConvo],
  documents: [],
  activeConversationId: defaultConvo.id,
  sidebarOpen: true,

  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  setProvider: (provider) => set({ provider }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  newConversation: () => {
    const id = uid();
    const convo: Conversation = { id, title: "New conversation", updatedAt: now(), messages: [] };
    set((s) => ({ conversations: [convo, ...s.conversations], activeConversationId: id }));
    return id;
  },
  selectConversation: (id) => set({ activeConversationId: id }),
  renameConversation: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    })),
  deleteConversation: (id) =>
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      const active = s.activeConversationId === id ? remaining[0]?.id ?? "" : s.activeConversationId;
      return { conversations: remaining, activeConversationId: active };
    }),

  appendMessage: (convoId, msg) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convoId
          ? {
              ...c,
              updatedAt: now(),
              title: c.messages.length === 0 && msg.role === "user" ? msg.content.slice(0, 48) : c.title,
              messages: [...c.messages, msg],
            }
          : c,
      ),
    })),
  updateMessage: (convoId, msgId, patch) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convoId
          ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
          : c,
      ),
    })),
  removeMessage: (convoId, msgId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convoId ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c,
      ),
    })),

  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  updateDocument: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  removeDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

  setDocuments: (documents) => set({ documents }),

  setConversationBackendId: (convoId, backendId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convoId ? { ...c, backendId } : c,
      ),
    })),
}));

export const newId = uid;
