import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/types/chat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  citation: Citation;
  onClick?: (c: Citation) => void;
}

export function CitationBadge({ citation, onClick }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onClick?.(citation)}
            className="group inline-flex"
          >
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1.5 rounded-full border border-border bg-accent/60 px-2.5 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent"
            >
              <FileText className="h-3 w-3 opacity-70" />
              <span className="max-w-[180px] truncate">{citation.documentName}</span>
              <span className="text-muted-foreground">· chunk {citation.chunk}</span>
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Open source · {citation.documentName} (chunk {citation.chunk})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
