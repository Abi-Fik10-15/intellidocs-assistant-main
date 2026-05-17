"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useChatStore } from "@/store/chat-store";

interface Props {
  content: string;
}

function MarkdownInner({ content }: Props) {
  const theme = useChatStore((s) => s.theme);
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) {
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children ?? "").replace(/\n$/, "");
            if (!inline && match) {
              return (
                <div className="my-3 overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                    <span>{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    language={match[1]}
                    style={theme === "dark" ? oneDark : oneLight}
                    customStyle={{ margin: 0, padding: "0.85rem 1rem", background: "transparent", fontSize: "0.825rem" }}
                    PreTag="div"
                  >
                    {text}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownInner);
