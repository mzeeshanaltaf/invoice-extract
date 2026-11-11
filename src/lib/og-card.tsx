/**
 * Shared social card for opengraph-image / twitter-image: paper, ink, a
 * ruled ledger of extracted figures and an EXTRACTED stamp. Hex values are the
 * sRGB equivalents of the OKLCH tokens in globals.css (satori has no OKLCH).
 */
const PAPER = "#faf6ee";
const SHEET = "#fefcf8";
const INK = "#121a2b";
const MUTED = "#4f5869";
const RULE = "#ddd7c9";
const VERMILION = "#c83314";
const GREEN = "#1b683e";

const ROWS: [string, string][] = [
  ["Vendor", "Halden & Birch Ltd"],
  ["Invoice no.", "HB-20417"],
  ["Due", "2026-11-13"],
  ["Subtotal", "193.00"],
  ["VAT 20%", "38.60"],
  ["Total GBP", "231.60"],
];

export function OgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        fontFamily: "sans-serif",
        color: INK,
        padding: "72px",
        position: "relative",
      }}
    >
      {/* left: words */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "560px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              border: `3px solid ${INK}`,
              borderRadius: "5px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: "4px",
            }}
          >
            <div style={{ width: "14px", height: "9px", border: `3px solid ${VERMILION}`, borderRadius: "2px" }} />
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, letterSpacing: "-0.5px" }}>InvoicExtract</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "76px", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-2px", display: "flex", flexWrap: "wrap" }}>
            Stop retyping supplier invoices.
          </div>
          <div style={{ fontSize: "28px", color: MUTED, marginTop: "26px", display: "flex" }}>
            Invoices in. Figures out. Every number checked.
          </div>
        </div>

        <div style={{ fontSize: "22px", color: MUTED, display: "flex" }}>invoicextract.zeeshanai.cloud</div>
      </div>

      {/* right: the ledger */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", position: "relative" }}>
        <div
          style={{
            width: "440px",
            display: "flex",
            flexDirection: "column",
            background: SHEET,
            border: `2px solid ${RULE}`,
            borderRadius: "6px",
            padding: "20px 0 8px",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "0 28px 12px",
              fontSize: "18px",
              letterSpacing: "3px",
              color: MUTED,
              fontWeight: 700,
              borderBottom: `2px solid ${INK}`,
            }}
          >
            EXTRACTED
          </div>
          {ROWS.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0 28px",
                height: "54px",
                alignItems: "center",
                fontSize: "24px",
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              <div style={{ color: MUTED, display: "flex" }}>{label}</div>
              <div style={{ fontWeight: 700, display: "flex", borderBottom: `4px solid ${VERMILION}` }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            right: "-16px",
            bottom: "34px",
            display: "flex",
            border: `6px solid ${GREEN}`,
            borderRadius: "6px",
            color: GREEN,
            fontSize: "40px",
            fontWeight: 800,
            letterSpacing: "5px",
            padding: "8px 24px",
            background: SHEET,
            transform: "rotate(-8deg)",
          }}
        >
          EXTRACTED
        </div>
      </div>
    </div>
  );
}
