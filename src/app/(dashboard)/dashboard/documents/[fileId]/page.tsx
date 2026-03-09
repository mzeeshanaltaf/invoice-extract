"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/lib/dashboard-context";
import type { MarkdownInvoiceResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFileSize } from "@/lib/utils";
import { MarkdownViewer } from "@/components/dashboard/markdown-viewer";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  AlertCircle,
} from "lucide-react";

export default function DocumentDetailPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const { getDocumentDetail } = useDashboardData();
  const [doc, setDoc] = useState<MarkdownInvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getDocumentDetail(fileId).then((result) => {
      if (cancelled) return;
      if (result) {
        setDoc(result);
      } else {
        setError(true);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fileId, getDocumentDetail]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-8 w-40" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
          <Link href="/dashboard/documents">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <h2 className="mb-2 text-lg font-semibold">Document not found</h2>
            <p className="text-sm text-muted-foreground">
              The document could not be loaded. It may have been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inv = doc.invoice_object;
  const data = inv.invoice_data;
  const meta = data.invoice_metadata;
  const totals = data.totals;
  const payment = data.payment_details;
  const bankDetails = payment?.bank_details;

  const confidenceColor =
    inv.confidence === "high"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : inv.confidence === "medium"
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

  const currency = meta?.currency ?? "USD";

  function formatAddress(addr?: { street?: string; city?: string; state?: string; postal_code?: string; country?: string }) {
    if (!addr) return null;
    return [addr.street, addr.city, addr.state, addr.postal_code, addr.country]
      .filter(Boolean)
      .join(", ") || null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-1">
            <Link href="/dashboard/documents">
              <ArrowLeft className="h-4 w-4" />
              Back to documents
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {doc.file_name}
          </h1>
          <div className="flex items-center gap-2">
            {inv.is_invoice_related && (
              <Badge variant="secondary">Invoice</Badge>
            )}
            <Badge className={confidenceColor}>
              {inv.confidence} confidence
            </Badge>
            {meta?.invoice_number && (
              <span className="text-sm text-muted-foreground">
                #{meta.invoice_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">Invoice Data</TabsTrigger>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="details">File Details</TabsTrigger>
        </TabsList>

        {/* Tab: Invoice Data */}
        <TabsContent value="data" className="space-y-6">
          {/* Invoice header info */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice Number
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {meta?.invoice_number || "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {meta?.invoice_date || "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Due Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {meta?.due_date || "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Balance Due
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {totals?.balance_due != null
                    ? `${currency} ${Number(totals.balance_due).toFixed(2)}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Seller & Buyer */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Seller */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4" />
                  Seller
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{data.seller?.name ?? "—"}</p>
                {formatAddress(data.seller?.address) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{formatAddress(data.seller?.address)}</span>
                  </div>
                )}
                {data.seller?.contact?.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.seller.contact.email}</span>
                  </div>
                )}
                {data.seller?.contact?.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.seller.contact.phone}</span>
                  </div>
                )}
                {data.seller?.contact?.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.seller.contact.website}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Buyer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Buyer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{data.buyer?.name ?? "—"}</p>
                {data.buyer?.company_name && (
                  <p className="text-muted-foreground">{data.buyer.company_name}</p>
                )}
                {formatAddress(data.buyer?.address) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{formatAddress(data.buyer?.address)}</span>
                  </div>
                )}
                {data.buyer?.contact?.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.buyer.contact.email}</span>
                  </div>
                )}
                {data.buyer?.contact?.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.buyer.contact.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line items */}
          {(data.line_items?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.line_items!.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">
                          {item.line_number ?? i + 1}
                        </TableCell>
                        <TableCell>
                          {item.description}
                          {item.item_code && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({item.item_code})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                          {item.unit_of_measure && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {item.unit_of_measure}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency} {Number(item.unit_price ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency} {Number(item.discount ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency} {Number(item.tax_amount ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {currency} {Number(item.line_total ?? 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Financials */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {currency} {Number(totals?.subtotal ?? 0).toFixed(2)}
                  </span>
                </div>
                {(totals?.discount_total ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>
                      -{currency} {Number(totals!.discount_total).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>
                    {currency} {Number(totals?.tax_total ?? 0).toFixed(2)}
                  </span>
                </div>
                {(totals?.shipping_cost ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {currency} {Number(totals!.shipping_cost).toFixed(2)}
                    </span>
                  </div>
                )}
                {(totals?.other_charges ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other Charges</span>
                    <span>
                      {currency} {Number(totals!.other_charges).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Grand Total</span>
                  <span>
                    {currency} {Number(totals?.grand_total ?? 0).toFixed(2)}
                  </span>
                </div>
                {(totals?.amount_paid ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount Paid</span>
                    <span>
                      -{currency} {Number(totals!.amount_paid).toFixed(2)}
                    </span>
                  </div>
                )}
                {totals?.balance_due != null && (
                  <div className="flex justify-between font-semibold text-primary">
                    <span>Balance Due</span>
                    <span>
                      {currency} {Number(totals.balance_due).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment details */}
          {payment && (bankDetails?.bank_name || bankDetails?.account_number || bankDetails?.iban || bankDetails?.swift_bic || payment.payment_terms || payment.payment_method) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  {payment.payment_terms && (
                    <div>
                      <span className="text-muted-foreground">Payment Terms: </span>
                      <span className="font-medium">{payment.payment_terms}</span>
                    </div>
                  )}
                  {payment.payment_method && (
                    <div>
                      <span className="text-muted-foreground">Payment Method: </span>
                      <span className="font-medium">{payment.payment_method}</span>
                    </div>
                  )}
                  {bankDetails?.bank_name && (
                    <div>
                      <span className="text-muted-foreground">Bank Name: </span>
                      <span className="font-medium">{bankDetails.bank_name}</span>
                    </div>
                  )}
                  {bankDetails?.account_number && (
                    <div>
                      <span className="text-muted-foreground">Account Number: </span>
                      <span className="font-medium">{bankDetails.account_number}</span>
                    </div>
                  )}
                  {bankDetails?.iban && (
                    <div>
                      <span className="text-muted-foreground">IBAN: </span>
                      <span className="font-medium">{bankDetails.iban}</span>
                    </div>
                  )}
                  {bankDetails?.swift_bic && (
                    <div>
                      <span className="text-muted-foreground">SWIFT/BIC: </span>
                      <span className="font-medium">{bankDetails.swift_bic}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {data.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{data.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Detected signals */}
          {(inv.detected_signals?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Detected Signals
              </p>
              <div className="flex flex-wrap gap-2">
                {inv.detected_signals!.map((signal) => (
                  <Badge key={signal} variant="outline" className="text-xs">
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Markdown */}
        <TabsContent value="markdown">
          <MarkdownViewer content={doc.markdown_text} />
        </TabsContent>

        {/* Tab: File Details */}
        <TabsContent value="details">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    File Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{doc.file_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    File Size
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatFileSize(doc.file_size)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pages
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{doc.num_pages}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    File ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {doc.file_id}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
