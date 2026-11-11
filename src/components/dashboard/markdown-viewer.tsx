"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface MarkdownViewerProps {
  content: string;
}

/** The raw text the model read from the document, for when a figure needs a second look. */
export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the text is selectable on screen
    }
  };

  if (!content) {
    return (
      <p className="text-muted-foreground border-border bg-card rounded-md border p-6 text-sm">
        There is no transcript for this document.
      </p>
    );
  }

  return (
    <div className="border-border bg-card rounded-md border">
      <div className="border-border flex h-12 items-center justify-between border-b px-4">
        <p className="eyebrow">Text as read</p>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="figures max-h-[600px] overflow-auto p-4 text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
        <code>{content}</code>
      </pre>
    </div>
  );
}
