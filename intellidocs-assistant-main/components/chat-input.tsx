"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPLOAD_ACCEPT } from "@/lib/upload";

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  onFiles?: (files: File[]) => void;
}

export function ChatInput({ onSend, onStop, isStreaming, onFiles }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if (!v || isStreaming) return;
    onSend(v);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft transition-shadow focus-within:shadow-elevated">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length && onFiles) onFiles(files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={!onFiles}
            aria-label="Attach document"
            title="Upload PDF, TXT, or Markdown"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask anything about your documents…"
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {isStreaming ? (
            <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={onStop} aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Answers are grounded in your uploaded documents. Verify before relying on them.
        </p>
      </div>
    </div>
  );
}
