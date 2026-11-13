import "server-only";
import { Document, Font, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import * as fontkit from "fontkit";
import type { TaxInvoice } from "@prisma/client";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { amountInWords, dmy, inr, invoiceTotals, itemAmount, parseTaxItems } from "./tax-invoice";
import { INVOICE_LOGO_BASE64, INVOICE_SIGNATURE_BASE64, MONTSERRAT_400, MONTSERRAT_500, MONTSERRAT_600, MONTSERRAT_700 } from "./tax-invoice-assets";

/* Replicates src/pdfinvoice/"Shield Defence Academy October 2026 Invoice.pdf" — same page size, logo,
   signature, Montserrat weights and positions (checked span-by-span with PyMuPDF), minus the
   "Powered by" watermark. All numbers are PDF points measured from that file.
   react-pdf puts a line's baseline at top + 0.968 × font size (Montserrat ascent), so
   `top(b, size)` turns a baseline measured in the reference into a box top. */

const F = "Montserrat";
Font.register({
  family: F,
  fonts: [
    { src: MONTSERRAT_400, fontWeight: 400 },
    { src: MONTSERRAT_500, fontWeight: 500 },
    { src: MONTSERRAT_600, fontWeight: 600 },
    { src: MONTSERRAT_700, fontWeight: 700 },
  ],
});
// Never hyphenate: react-pdf would add its own "-" at a break. Addresses are wrapped by `wrap()` below instead.
Font.registerHyphenationCallback((word) => [word]);

// Same font files react-pdf uses, for measuring line widths.
const METRIC_FONTS = new Map<number, { layout: (s: string) => { advanceWidth: number }; unitsPerEm: number }>();
function metricFont(weight: number) {
  let f = METRIC_FONTS.get(weight);
  if (!f) {
    const src = { 400: MONTSERRAT_400, 500: MONTSERRAT_500, 600: MONTSERRAT_600, 700: MONTSERRAT_700 }[weight] ?? MONTSERRAT_400;
    f = fontkit.create(Buffer.from(src.slice(src.indexOf(",") + 1), "base64"));
    METRIC_FONTS.set(weight, f!);
  }
  return f!;
}
const textWidth = (s: string, size: number, weight: number) => {
  const f = metricFont(weight);
  return (f.layout(s).advanceWidth * size) / f.unitsPerEm;
};

/** Greedy wrap that breaks at spaces and after hyphens ("Lucknow-" / "226016"), like the template. */
function wrap(text: string, width: number, size: number, weight = 400): string[] {
  const tokens = text.split(/(?<= )|(?<=-)(?=\S)/); // each keeps its trailing space / hyphen
  const out: string[] = [];
  let line = "";
  for (const tok of tokens) {
    const next = line + tok;
    if (line && textWidth(next.trimEnd(), size, weight) > width) {
      out.push(line.trimEnd());
      line = tok.trimStart();
    } else line = next;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}

const PAGE: [number, number] = [595.92, 842.88];
const L = 45.9; // left edge of the content
const R = 550.8; // right edge of the content
const RM = PAGE[0] - R; // right margin
const ASC = 0.968;
const TOP = 40; // top margin of continuation pages
const top = (baseline: number, size: number) => baseline - ASC * size;
const LINE = "#ECECEC";
const HEAD_BG = "#EFF0F1";

const t = (size: number, weight = 400, extra: Style = {}): Style => ({ fontFamily: F, fontSize: size, fontWeight: weight, color: "#000", ...extra });
const abs = (x: number, y: number, extra: Style = {}): Style => ({ position: "absolute", left: x, top: y, ...extra });

// Table columns: [left, right] edges and text padding.
const COL = {
  item: { l: L, r: 249.3, pad: 11.7 },
  qty: { l: 249.3, r: 297.9, pad: 7.8 },
  price: { l: 297.9, r: 394.2, pad: 7.6 },
  disc: { l: 394.2, r: 441.9, pad: 7.2 },
  amount: { l: 441.9, r: R, pad: 11.7 },
};
/** A table cell; every column after the first starts with the 0.9pt separator line. */
const cell = (c: { l: number; r: number; pad: number }, align: "left" | "right", k: number): Style => ({
  width: c.r - c.l,
  ...(align === "left" ? { paddingLeft: c.pad } : { paddingRight: c.pad, alignItems: "flex-end" }),
  ...(k ? { borderLeftWidth: 0.9, borderColor: LINE } : {}),
});
const PT = top(299.7, 9) - 286.2; // item row: top padding

const lines = (s: string | null | undefined) => (s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const fmtNum = (n: number) => n.toFixed(2);
const fmtPct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} %`;

let logoBuf: Buffer | null = null;
let signBuf: Buffer | null = null;

function InvoiceDoc({ inv, settings }: { inv: TaxInvoice; settings: Settings }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const items = parseTaxItems(inv.items);
  const totals = invoiceTotals(items, inv.placeOfSupply, s.tinv_seller_state);
  const logo = (logoBuf ??= Buffer.from(INVOICE_LOGO_BASE64, "base64"));
  const sign = (signBuf ??= Buffer.from(INVOICE_SIGNATURE_BASE64, "base64"));
  const addr = (x: string | null) => (x ?? "").replace(/\s*\r?\n\s*/g, " ").trim();
  const shipName = inv.shipName || inv.billName;
  const shipAddress = inv.shipName || inv.shipAddress ? inv.shipAddress : inv.billAddress;

  const headerRight = (label: string, value: string, baseline: number, bold = false) => (
    <>
      <Text style={abs(429.98, top(baseline, 7.2), t(7.2, bold ? 600 : 400))}>{label}</Text>
      {bold ? (
        <Text style={abs(429.98, top(baseline - 0.9, 6.3), t(6.3, 600, { width: 550.6 - 429.98, textAlign: "right" }))}>{value}</Text>
      ) : (
        <Text style={abs(429.98, top(baseline, 7.2), t(7.2, 400, { width: 550.7 - 429.98, textAlign: "right" }))}>{value}</Text>
      )}
    </>
  );

  const W = 112; // wrap width of the Bill To / Ship To addresses (matches the template's breaks)
  const small = (extra: Style = {}) => t(7.2, 400, { lineHeight: 10.8 / 7.2, ...extra });

  // Totals rows: baseline gaps taken from the template.
  type Row = { label: string; value: string; size: number; weight: number; gap: number };
  const rows: Row[] = [
    { label: "SUB TOTAL", value: inr(totals.subtotal), size: 9, weight: 600, gap: 0 },
    ...totals.taxes.map((x, k) => ({ label: x.label, value: inr(x.amount), size: 7.2, weight: 400, gap: k === 0 ? 15.3 : 14.4 })),
    { label: "TOTAL", value: inr(totals.total), size: 10.8, weight: 600, gap: totals.taxes.length ? 18.0 : 19.8 },
  ];
  let base = 0;

  return (
    <Document title={`Invoice ${inv.number}`} author={s.tinv_seller_name} creator={s.tinv_seller_name} producer={s.tinv_seller_name}>
      <Page size={PAGE} style={{ paddingTop: TOP, paddingBottom: 40, fontFamily: F }}>
        {/* ── Header (first page only; later pages start at the top margin) ── */}
        <View style={{ position: "relative", marginTop: -TOP, width: PAGE[0], height: 160.5 }}>
          <Image src={{ data: logo, format: "jpg" }} style={abs(L, 38.7, { width: 124.2 - L, height: 63, objectFit: "fill" })} />
          <View style={abs(131.25, top(39.6, 9))}>
            <Text style={t(9, 600, { lineHeight: 1 })}>{s.tinv_seller_name}</Text>
            <View style={{ marginTop: top(58.5, 7.2) - top(39.6, 9) - 9 }}>
              {lines(s.tinv_seller_address).map((x, k) => <Text key={k} style={small()}>{x}</Text>)}
            </View>
            <Text style={small({ marginTop: 3.6 })}>{s.tinv_seller_email}</Text>
            <Text style={small({ marginTop: 1.8 })}>{s.tinv_seller_phone}</Text>
          </View>
          {s.tinv_seller_gstin && (
            <Text style={abs(301.95, top(57.6, 7.2), t(7.2))}>
              GSTIN: <Text style={t(7.2, 500)}>{s.tinv_seller_gstin}</Text>
            </Text>
          )}
          {headerRight("Invoice No:", inv.number, 57.6, true)}
          {headerRight("Issued Date:", dmy(inv.issueDate), 72.0)}
          {inv.dueDate && headerRight("Due Date:", dmy(inv.dueDate), 86.4)}
          <Text style={abs(L, top(148.5, 10.8), t(10.8, 700))}>TAX INVOICE</Text>
          <View style={abs(130.5, 152.1, { width: R - 130.5, height: 0.9, backgroundColor: LINE })} />
        </View>

        {/* ── Bill to / Ship to / Place of supply ── */}
        <View style={{ flexDirection: "row", paddingLeft: L, marginTop: top(175.5, 7.2) - 160.5 }}>
          <View style={{ width: 179.33 - L }}>
            <Text style={small()}>Bill To:</Text>
            <Text style={small({ fontWeight: 600, marginTop: 3.6, width: W })}>{inv.billName}</Text>
            {wrap(addr(inv.billAddress), W, 7.2).map((x, k) => <Text key={k} style={small()}>{x}</Text>)}
            {inv.billGstin && <Text style={small({ width: W })}>GSTIN: {inv.billGstin}</Text>}
          </View>
          <View style={{ width: 312.75 - 179.33 }}>
            <Text style={small()}>Ship To:</Text>
            <Text style={small({ fontWeight: 600, marginTop: 7.2, width: W })}>{shipName}</Text>
            <View style={{ marginTop: 3.6 }}>
              {wrap(addr(shipAddress), W, 7.2).map((x, k) => <Text key={k} style={small()}>{x}</Text>)}
            </View>
          </View>
          <View style={{ width: 130 }}>
            <Text style={small()}>Place Of Supply:</Text>
            <Text style={small({ fontWeight: 600, marginTop: 3.6 })}>{inv.placeOfSupply}</Text>
          </View>
        </View>

        {/* ── Items table ── */}
        <View style={{ marginLeft: L, width: R - L, marginTop: 261.0 - 247.73 }}>
          {/* `fixed`: repeated at the top of the table on every page it runs onto. */}
          <View fixed style={{ flexDirection: "row", height: 25.2, backgroundColor: HEAD_BG }} wrap={false}>
            {(
              [
                ["Item Details", COL.item, "left"],
                ["Qty", COL.qty, "right"],
                ["Price", COL.price, "right"],
                ["Disc", COL.disc, "right"],
                ["Amount", COL.amount, "right"],
              ] as const
            ).map(([label, c, a], k) => (
              <View key={label} style={{ ...cell(c, a, k), paddingTop: top(277.2, 9) - 261.0 }}>
                <Text style={t(9, 600, { lineHeight: 1 })}>{label}</Text>
              </View>
            ))}
            <View style={abs(0, 0, { width: R - L, height: 25.2, borderWidth: 0.9, borderColor: LINE })} />
          </View>
          {items.map((i, n) => (
            <View key={n} wrap={false} style={{ flexDirection: "row", borderBottomWidth: 0.9, borderColor: LINE }}>
              <View style={{ ...cell(COL.item, "left", 0), paddingTop: PT, paddingBottom: 326.7 - (top(315.0, 7.2) + 10.8) }}>
                <Text style={t(9, 500, { lineHeight: 1.5 })}>{i.name}</Text>
                {i.description && <Text style={small({ color: "#333333" })}>{i.description}</Text>}
                {i.taxRate > 0 && <Text style={small({ marginTop: top(315.0, 7.2) - (top(299.7, 9) + 13.5) })}>Tax: {i.taxRate.toFixed(2)} %</Text>}
              </View>
              <View style={{ ...cell(COL.qty, "right", 1), paddingTop: PT }}>
                <Text style={t(9, 400, { lineHeight: 1.5 })}>{fmtNum(i.qty)}</Text>
                {i.unit && <Text style={t(9, 400, { lineHeight: 1.5 })}>{i.unit}</Text>}
              </View>
              <View style={{ ...cell(COL.price, "right", 2), paddingTop: PT }}>
                <Text style={t(9, 400, { lineHeight: 1 })}>{inr(i.price)}</Text>
              </View>
              <View style={{ ...cell(COL.disc, "right", 3), paddingTop: PT }}>
                <Text style={t(9, 400, { lineHeight: 1 })}>{fmtPct(i.discount)}</Text>
              </View>
              <View style={{ ...cell(COL.amount, "right", 4), paddingTop: PT }}>
                <Text style={t(9, 600, { lineHeight: 1 })}>{inr(itemAmount(i))}</Text>
              </View>
              <View style={abs(0, 0, { bottom: 0, width: 0.9, backgroundColor: LINE })} />
              <View style={abs(R - L - 0.9, 0, { bottom: 0, width: 0.9, backgroundColor: LINE })} />
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View wrap={false} style={{ marginTop: top(368.1, 9) - 327.6 }}>
          {rows.map((r, k) => {
            const b = (base += r.gap);
            const prev = k === 0 ? null : rows[k - 1];
            // gap is baseline-to-baseline; convert to a margin between fixed-height (= size) boxes.
            const mt = prev ? b - (base - r.gap) - ASC * r.size + ASC * prev.size - prev.size : 0;
            return (
              <View key={k} style={{ flexDirection: "row", height: r.size, marginTop: mt }}>
                <Text style={t(r.size, r.weight, { lineHeight: 1, position: "absolute", left: 300, width: 424.6 - 300, textAlign: "right" })}>{r.label}</Text>
                <Text style={t(r.size, r.weight, { lineHeight: 1, position: "absolute", left: 430, width: R - 430, textAlign: "right" })}>{r.value}</Text>
              </View>
            );
          })}
          <Text style={small({ marginLeft: 302.4, width: R - 302.4, textAlign: "right", marginTop: 435.6 - 415.8 - ASC * 7.2 + ASC * 10.8 - 10.8 })}>
            Total In Words<Text style={{ fontWeight: 600 }}>: {amountInWords(totals.total)}</Text>
          </Text>
        </View>

        {/* ── Signature ── */}
        <View wrap={false} style={{ marginLeft: 473.4, marginTop: 479.7 - 450.23 }}>
          <Image src={{ data: sign, format: "png" }} style={{ width: R - 473.4, height: 54 }} />
          <Text style={small({ marginTop: top(541.8, 7.2) - 533.7 })}>Authorised Signature</Text>
        </View>

        {/* ── Terms & declaration ── */}
        {lines(inv.terms).length > 0 && (
          <View wrap={false} style={{ marginLeft: L, width: R - L, marginTop: top(579.6, 7.2) - 545.63 }}>
            <Text style={small()}>Terms & Conditions:</Text>
            {lines(inv.terms).map((x, k) => <Text key={k} style={small()}>{x}</Text>)}
          </View>
        )}
        {inv.declaration?.trim() && (
          <View wrap={false} style={{ marginLeft: L, width: R - L, marginTop: lines(inv.terms).length ? 10.8 : top(579.6, 7.2) - 545.63 }}>
            <Text style={small()}>Declaration:</Text>
            <Text style={small()}>{inv.declaration.trim()}</Text>
          </View>
        )}

        {/* ── Footer (every page) ── */}
        <Text fixed style={abs(153.0, top(835.2, 7.2), t(7.2, 400, { color: "#222222" }))}>
          This document is computer-generated and does not require a physical signature
        </Text>
      </Page>
    </Document>
  );
}

export async function taxInvoicePdf(inv: TaxInvoice, settings: Settings): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc inv={inv} settings={settings} />);
}
