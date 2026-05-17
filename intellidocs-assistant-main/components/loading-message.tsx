import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";

export function LoadingMessage() {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-soft">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex max-w-[85%] flex-1 flex-col gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-soft">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
