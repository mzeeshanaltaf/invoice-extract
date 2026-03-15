"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/dashboard-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFileSize } from "@/lib/utils";
import Link from "next/link";
import { FileStack, Upload, ArrowRight, Eye, ScanEye } from "lucide-react";
import type { UserDocument } from "@/lib/types";

export default function DocumentsPage() {
  const { documents, isLoading } = useDashboardData();
  const [previewDoc, setPreviewDoc] = useState<UserDocument | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your processed invoices and their extracted data.
          </p>
        </div>
        {documents.length > 0 && (
          <Button asChild size="sm" className="gap-2">
            <Link href="/dashboard/upload">
              <Upload className="h-4 w-4" />
              Upload
            </Link>
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <FileStack className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No documents yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Upload your first invoice to see it appear here with all the
              extracted data.
            </p>
            <Button asChild className="gap-2">
              <Link href="/dashboard/upload">
                Upload invoice <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.file_id}>
                  <TableCell className="font-medium">
                    {doc.file_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {doc.mime_type === "application/pdf"
                        ? "PDF"
                        : doc.mime_type.replace("image/", "").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <ScanEye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="gap-1">
                      <Link href={`/dashboard/documents/${doc.file_id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Document preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDoc?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-muted/30">
            {previewDoc?.mime_type === "application/pdf" ? (
              <iframe
                src={`data:application/pdf;base64,${previewDoc.file_base64}`}
                className="h-[65vh] w-full rounded-md"
                title={previewDoc.file_name}
              />
            ) : (
              <img
                src={`data:${previewDoc?.mime_type};base64,${previewDoc?.file_base64}`}
                alt={previewDoc?.file_name}
                className="mx-auto max-h-[65vh] object-contain p-2"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
