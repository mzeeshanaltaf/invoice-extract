"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="absolute right-3 top-3 gap-1.5"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </Button>
      <pre className="max-h-[600px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}
