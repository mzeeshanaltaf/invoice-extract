import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileX } from "lucide-react";

export default function DocumentNotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <FileX className="mb-4 h-10 w-10 text-muted-foreground/50" />
      <h2 className="mb-2 text-lg font-semibold">Document not found</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        The document you&apos;re looking for doesn&apos;t exist or may have been
        removed.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard/documents">Back to documents</Link>
      </Button>
    </div>
  );
}
