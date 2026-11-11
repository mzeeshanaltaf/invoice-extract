import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InvoicExtract: AI Invoice Data Extraction",
    short_name: "InvoicExtract",
    description:
      "Extract structured data from invoices instantly. Upload PDFs or images and get line items, totals, and vendor details powered by AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ee",
    theme_color: "#c83314",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
