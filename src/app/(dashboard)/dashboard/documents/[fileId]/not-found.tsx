import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DocumentNotFound() {
  return (
    <div className="border-border bg-card max-w-xl rounded-md border p-8">
      <h2 className="font-display text-2xl font-bold">Document not found.</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        It does not exist, or it was deleted.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href="/dashboard/documents">Back to documents</Link>
      </Button>
    </div>
  );
}
