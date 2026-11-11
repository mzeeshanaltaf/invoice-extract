export function buildJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema);
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "InvoicExtract",
  url: "https://invoicextract.zeeshanai.cloud",
  logo: "https://invoicextract.zeeshanai.cloud/icon",
  sameAs: [],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "InvoicExtract",
  url: "https://invoicextract.zeeshanai.cloud",
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "InvoicExtract",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://invoicextract.zeeshanai.cloud",
  description:
    "AI-powered invoice data extraction. Upload PDFs or images and get structured line items, totals, and vendor details.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free to start: 5 credits on signup, no credit card required.",
  },
};
