import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Besley, Geist_Mono, Schibsted_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { StampDefs } from "@/components/brand/stamp";
import { buildJsonLd, organizationSchema, websiteSchema } from "@/lib/json-ld";
import "./globals.css";

// Display: a Clarendon-style slab for headlines and the wordmark only.
const besley = Besley({
  variable: "--font-besley",
  subsets: ["latin"],
  display: "swap",
});

// UI and body: a sturdy grotesque with open, even letterforms.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

// Figures and JSON only.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://invoicextract.zeeshanai.cloud"),
  title: {
    default: "InvoicExtract: AI Invoice Data Extraction",
    template: "%s | InvoicExtract",
  },
  description:
    "Extract structured data from invoices instantly. Upload PDFs or images and get line items, totals, and vendor details powered by AI.",
  openGraph: {
    siteName: "InvoicExtract",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://invoicextract.zeeshanai.cloud/opengraph-image",
        width: 1200,
        height: 630,
        alt: "InvoicExtract: AI Invoice Data Extraction",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1420" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${besley.variable} ${schibsted.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <StampDefs />
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
