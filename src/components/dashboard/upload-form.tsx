"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { ProcessingDialog } from "@/components/dashboard/processing-dialog";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "image/png": ImageIcon,
  "image/jpeg": ImageIcon,
};

interface UploadFormProps {
  credits: number;
  onUploadSuccess?: () => void;
}

export function UploadForm({ credits, onUploadSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const router = useRouter();

  // Generate preview URL for images, revoke on cleanup
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [file]);

  const handleFile = useCallback((f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setResult({
        success: false,
        message: "Unsupported file type. Please use PDF, PNG, or JPEG.",
      });
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;

    if (credits <= 0) {
      setResult({
        success: false,
        message: "No credits remaining. Please upgrade your plan.",
      });
      return;
    }

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, message: data.message });
        onUploadSuccess?.();
        setTimeout(() => router.push("/dashboard/documents"), 2000);
      } else {
        setResult({
          success: false,
          message: data.error || data.message || "Processing failed",
        });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
  };

  const FileIcon = file ? FILE_TYPE_ICONS[file.type] ?? FileText : FileText;

  return (
    <>
    <ProcessingDialog open={isUploading} />
    <div className="space-y-4">
      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
      >
        <CardContent className="py-0">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className="flex flex-col items-center justify-center py-16"
          >
            {!file ? (
              <>
                <Upload className="mb-4 h-10 w-10 text-muted-foreground/50" />
                <p className="mb-1 text-sm font-medium">
                  Drag and drop your invoice here
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  PDF, PNG, or JPEG up to 10MB
                </p>
                <label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">Browse files</span>
                  </Button>
                </label>
              </>
            ) : (
              <div className="flex w-full max-w-md flex-col items-center gap-4">
                {/* File preview */}
                {preview ? (
                  <div className="relative w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={file.name}
                      className="h-auto max-h-64 w-full object-contain"
                    />
                  </div>
                ) : file.type === "application/pdf" ? (
                  <div className="flex h-40 w-full max-w-xs items-center justify-center rounded-lg border border-border bg-muted/20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-12 w-12" />
                      <span className="text-xs font-medium uppercase tracking-wider">
                        PDF Document
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* File info */}
                <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <FileIcon className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result alert */}
      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      {/* Upload button */}
      {file && !result?.success && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" />
          Extract invoice data
        </Button>
      )}
    </div>
    </>
  );
}
