"use client";

import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";
import { ThemeInit } from "@/components/theme-init";
import { AppBootstrap } from "@/components/app-bootstrap";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

export function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);

  return (
    <>
      <ThemeInit />
      <Toaster richColors position="top-center" />
      <AppBootstrap />
      <div className="relative flex h-screen w-full overflow-hidden bg-background">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Close sidebar overlay"
            onClick={toggleSidebar}
          />
        )}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar />
        </div>
        <ChatView />
      </div>
    </>
  );
}
