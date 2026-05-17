"use client";

import { FileQuestion, Sparkles, BookOpen, Quote } from "lucide-react";
import type { UploadedDocument } from "@/types/chat";

interface Props {
  onPick: (prompt: string) => void;
  documents: UploadedDocument[];
}

function buildSuggestions(documents: UploadedDocument[]) {
  const ready = documents
    .filter((d) => d.status === "ready")
    .sort((a, b) => b.uploadedAt - a.uploadedAt);

  const latest = ready[0];

  const summarizePrompt = latest
    ? `Summarize "${latest.name}". Give a concise overview of the key points.`
    : "Summarize my most recently uploaded document with a concise overview of the key points.";

  const comparePrompt =
    ready.length >= 2
      ? `Compare "${ready[0].name}" and "${ready[1].name}". What are the key differences?`
      : ready.length === 1
        ? `Summarize "${ready[0].name}" and note what topics a second document could be compared against.`
        : "Upload at least two documents, then compare their main themes and differences.";

  const quotesPrompt = ready.length
    ? `Find three supporting quotes from ${ready.map((d) => `"${d.name}"`).join(", ")} that describe the main workflow or recommendations.`
    : "Find three quotes from my documents that describe the recommended workflow.";

  const briefPrompt = ready.length
    ? `Draft a one-page brief based on: ${ready.map((d) => d.name).join(", ")}.`
    : "Draft a one-page brief based on the indexed documents.";

  return [
    { icon: FileQuestion, title: "Summarize my latest PDF", prompt: summarizePrompt, needsReady: true },
    { icon: BookOpen, title: "Compare two documents", prompt: comparePrompt, needsReady: true },
    { icon: Quote, title: "Find supporting quotes", prompt: quotesPrompt, needsReady: true },
    { icon: Sparkles, title: "Draft a brief", prompt: briefPrompt, needsReady: true },
  ];
}

export function ChatEmpty({ onPick, documents }: Props) {
  const readyCount = documents.filter((d) => d.status === "ready").length;
  const suggestions = buildSuggestions(documents);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-elevated">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ask anything about your documents</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Upload PDFs, notes, or Markdown — get grounded answers with citations pointing back to the exact source chunks.
      </p>

      {readyCount === 0 && documents.length > 0 && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          Documents are still processing. Wait until status shows <strong>ready</strong>, then use a suggestion below.
        </p>
      )}

      {documents.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Upload a document in the sidebar to enable the quick actions below.
        </p>
      )}

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {suggestions.map((s) => {
          const Icon = s.icon;
          const disabled = s.needsReady && readyCount === 0;
          return (
            <button
              key={s.title}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.prompt)}
              className="group rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Icon className="mb-2 h-4 w-4 text-primary" />
              <div className="text-sm font-medium text-foreground">{s.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.prompt}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
