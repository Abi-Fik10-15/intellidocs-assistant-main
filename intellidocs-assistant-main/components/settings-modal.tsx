"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Settings as SettingsIcon, Sun, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useChatStore } from "@/store/chat-store";
import type { LLMProvider } from "@/types/chat";
import {
  ApiClientError,
  fetchSettings,
  updateLlmProvider,
  type AppSettings,
  type ProviderStatus,
} from "@/lib/api";

const PROVIDER_META: Record<LLMProvider, { name: string; description: string }> = {
  openai: {
    name: "OpenAI",
    description: "GPT-class models · best general performance",
  },
  claude: {
    name: "Anthropic Claude",
    description: "Strong long-context comprehension",
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini Flash · fast and cost-effective",
  },
};

function statusLabel(p: ProviderStatus): string {
  if (p.active) return "active";
  if (p.configured) return "ready";
  return "not configured";
}

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<LLMProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const theme = useChatStore((s) => s.theme);
  const toggleTheme = useChatStore((s) => s.toggleTheme);
  const provider = useChatStore((s) => s.provider);
  const setProvider = useChatStore((s) => s.setProvider);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings();
      setSettings(data);
      setProvider(data.llmProvider);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [setProvider]);

  useEffect(() => {
    if (open) void loadSettings();
  }, [open, loadSettings]);

  const handleSelectProvider = async (id: LLMProvider) => {
    const meta = settings?.providers.find((p) => p.id === id);
    if (!meta?.configured || id === provider) return;

    setSwitching(id);
    setError(null);
    try {
      const data = await updateLlmProvider(id);
      setSettings(data);
      setProvider(data.llmProvider);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not switch provider");
    } finally {
      setSwitching(null);
    }
  };

  const providers = settings?.providers ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Personalize your assistant and connections.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</Label>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground capitalize">{theme} mode</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                Switch to {theme === "dark" ? "light" : "dark"}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              LLM provider
            </Label>
            {loading && !settings ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading providers…
              </div>
            ) : (
              <div className="space-y-2">
                {(providers.length > 0
                  ? providers
                  : (["openai", "claude", "gemini"] as LLMProvider[]).map((id) => ({
                      id,
                      configured: false,
                      active: id === provider,
                    }))
                ).map((p) => {
                  const meta = PROVIDER_META[p.id];
                  const active = provider === p.id;
                  const disabled = !p.configured || switching !== null;
                  const isSwitching = switching === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleSelectProvider(p.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/50"
                      } ${!p.configured ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{meta.name}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.active
                                ? "bg-primary/10 text-primary"
                                : p.configured
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isSwitching ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  p.active
                                    ? "bg-primary"
                                    : p.configured
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground"
                                }`}
                              />
                            )}
                            {isSwitching ? "switching…" : statusLabel(p)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                        {!p.configured && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Add{" "}
                            {p.id === "openai"
                              ? "OPENAI_API_KEY"
                              : p.id === "claude"
                                ? "ANTHROPIC_API_KEY"
                                : "GEMINI_API_KEY"}{" "}
                            to backend/.env
                          </p>
                        )}
                      </div>
                      {active && !isSwitching && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
