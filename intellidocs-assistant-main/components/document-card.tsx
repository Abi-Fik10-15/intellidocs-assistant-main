"use client";

import { useState } from "react";
import { FileText, Loader2, Trash2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedDocument } from "@/types/chat";
import { formatBytes } from "@/lib/format";

interface Props {
  doc: UploadedDocument;
  onRemove: (id: string) => void;
  onReingest?: (id: string) => void;
}

export function DocumentCard({ doc, onRemove, onReingest }: Props) {
  const [retrying, setRetrying] = useState(false);

  const handleReingest = () => {
    if (!onReingest || retrying) return;
    setRetrying(true);
    void Promise.resolve(onReingest(doc.id)).finally(() => setRetrying(false));
  };

  return (
    <div className="group rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="break-words text-xs font-medium leading-snug text-foreground" title={doc.name}>
              {doc.name}
            </p>
            {doc.status === "ready" && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />}
            {doc.status === "error" && <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />}
            {(doc.status === "uploading" || doc.status === "processing" || retrying) && (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatBytes(doc.size)}</span>
            <span>·</span>
            <span className="capitalize">
              {retrying ? "processing" : doc.status === "error" ? "failed" : doc.status}
            </span>
          </div>
          {doc.status === "error" && doc.errorMessage && (
            <p className="mt-1 text-[10px] leading-snug text-destructive">{doc.errorMessage}</p>
          )}
          {doc.status === "error" && onReingest && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 gap-1 px-2 text-[10px]"
              onClick={handleReingest}
              disabled={retrying}
            >
              <RotateCcw className="h-3 w-3" />
              Re-ingest
            </Button>
          )}
          {(doc.status === "uploading" || doc.status === "processing") && !retrying && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${doc.progress}%` }}
              />
            </div>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7 shrink-0 border-border text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(doc.id)}
          aria-label={`Delete ${doc.name}`}
          title="Delete document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
