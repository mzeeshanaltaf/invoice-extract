import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { buildJsonLd, organizationSchema, websiteSchema } from "@/lib/json-ld";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://invoicextract.zeeshanai.cloud"),
  title: {
    default: "InvoiceExtract — AI-Powered Invoice Data Extraction",
    template: "%s — InvoiceExtract",
  },
  description:
    "Extract structured data from invoices instantly. Upload PDFs or images and get line items, totals, and vendor details powered by AI.",
  openGraph: {
    siteName: "InvoiceExtract",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://invoicextract.zeeshanai.cloud/opengraph-image",
        width: 1200,
        height: 630,
        alt: "InvoiceExtract — AI-Powered Invoice Data Extraction",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@invoicextract",
    images: ["https://invoicextract.zeeshanai.cloud/twitter-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildJsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildJsonLd(websiteSchema) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID &&
          process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL && (
            <Script
              src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL}
              data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
              strategy="afterInteractive"
            />
          )}
      </body>
    </html>
  );
}
