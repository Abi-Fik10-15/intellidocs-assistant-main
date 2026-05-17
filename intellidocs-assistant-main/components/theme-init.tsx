"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat-store";

/** Hydrates theme from localStorage on the client only. */
export function ThemeInit() {
  const setTheme = useChatStore((s) => s.setTheme);
  useEffect(() => {
    const saved = (localStorage.getItem("doqa-theme") as "light" | "dark" | null) ?? null;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(saved ?? (prefersDark ? "dark" : "light"));
  }, [setTheme]);

  const theme = useChatStore((s) => s.theme);
  useEffect(() => {
    localStorage.setItem("doqa-theme", theme);
  }, [theme]);

  return null;
}
