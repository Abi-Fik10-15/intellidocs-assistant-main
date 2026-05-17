"use client";

import { useCallback, useState, type DragEvent } from "react";
import { CloudUpload } from "lucide-react";
import { filterUploadFiles, UPLOAD_ACCEPT } from "@/lib/upload";

interface Props {
  onFiles: (files: File[]) => void;
}

export function UploadZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragging(false);
      const files = filterUploadFiles(Array.from(e.dataTransfer.files));
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <CloudUpload className="h-5 w-5 text-muted-foreground" />
      <div className="text-xs font-medium text-foreground">Drop files or click to upload</div>
      <div className="text-[10px] text-muted-foreground">PDF · TXT · MD · up to 20 MB</div>
      <input
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
