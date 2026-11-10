import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { LineItem, Quotation } from "@prisma/client";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { round2 } from "./format";
import { docNumber } from "./sales";
import { ARROW_FONT, wrapRuns, type FontName, type Run } from "./pdf-metrics";
import { asSections, asSteps, parseScopeBody, parseTerms, rupees, servicePoints, slashDate, type ScopeBlock } from "./quotation-content";

/* Measured from the Squareit quotation template (src/pdformats). A4 = 595.3 × 841.9 pt.
   Sizes, colours and offsets below reproduce that file; change them together.
   Text offsets look odd (e.g. marginTop 6.1) because react-pdf places glyphs a little
   higher in their line box than the template did. */

const C = {
  navy: "#0f1d3d",
  blue: "#2d59ac",
  tint: "#e9eff9",
  grey: "#f4f4f6",
  line: "#dde2eb",
  rule: "#e2e6eb",
  ghost: "#dde3ec",
  text: "#333a45",
  sub: "#4a5262",
  head: "#1b2436",
  muted: "#5a6472",
};
const PAGE_W = 595.28;
const X = 45.35; // side margin
const W = PAGE_W - 2 * X; // content width
const IN = 6; // headings and body text sit 6pt inside the margin

/* The built-in PDF font (Helvetica) only has Western characters: swap the common
   others so they don't print as garbage. */
const SWAP: Record<string, string> = { "‐": "-", "‑": "-", "‒": "–", " ": " ", " ": " ", "→": "->", "←": "<-", "⇒": "=>", "₹": "Rs.", "✓": "-", "✔": "-", "≥": ">=", "≤": "<=", "×": "x", "−": "-" };
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function T(v: string | null | undefined, keepArrows = false) {
  return [...(v ?? "")]
    .map((ch) => {
      if (keepArrows && ch === "→") return ch;
      if (SWAP[ch]) return SWAP[ch];
      const c = ch.charCodeAt(0);
      return c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_ANSI_EXTRA.includes(ch) ? ch : "";
    })
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const R: FontName = "Helvetica";
const B: FontName = "Helvetica-Bold";
const I: FontName = "Helvetica-Oblique";

const s = StyleSheet.create({
  // No lineHeight on the page: in react-pdf 4 it hides the absolutely positioned footer.
  page: { paddingTop: 80.6, paddingBottom: 54, paddingHorizontal: X, fontFamily: R, fontSize: 9, color: C.text },

  // Page 1 header (pulled up into the top padding). Rule sits at y = 93.5.
  head: { marginTop: -44.6, height: 57.5, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderColor: C.navy },
  brand: { flexDirection: "row" },
  logo: { width: 42.5, height: 42.5, marginTop: 6.5, marginRight: 8.5 },
  brandName: { fontSize: 13, fontFamily: B, color: C.navy, marginTop: 6.1 },
  brandLines: { marginTop: 0.9 },
  brandLine: { fontSize: 7.5, color: C.muted, marginTop: 1.1, lineHeight: 1.2 },
  titleCol: { alignItems: "flex-end" },
  title: { fontSize: 24, fontFamily: B, color: C.navy, marginTop: 4.8 },
  date: { fontSize: 9, color: C.muted, marginTop: 4.1 },

  // Running header on pages 2+ (logo at y 25.5, rule at y 59.5).
  run: { position: "absolute", top: 25.5, left: X, right: X, height: 34, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: C.line },
  runLogo: { width: 28.35, height: 28.35, marginRight: 5.7 },
  runName: { fontSize: 10, fontFamily: B, color: C.navy, marginTop: 9.4 },
  runRight: { fontSize: 8, color: C.muted, marginTop: 11.2 },

  // Footer band on every page.
  foot: { position: "absolute", bottom: 0, left: 0, right: 0, height: 34, paddingTop: 3, backgroundColor: C.navy, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: X },
  footL: { color: "#ffffff", fontSize: 8, fontFamily: B },
  footR: { color: "#ffffff", fontSize: 8 },

  // Prepared for / Quotation for (y 125.1 → 178.1, split at the page centre).
  boxes: { flexDirection: "row", marginTop: 31.6, marginBottom: 3.8, height: 53 },
  boxL: { flex: 1, backgroundColor: C.tint, paddingTop: 10.8, paddingHorizontal: 10 },
  boxR: { flex: 1, backgroundColor: C.grey, paddingTop: 10.8, paddingHorizontal: 10 },
  boxEdge: { position: "absolute", left: -1.5, top: 0, bottom: 0, width: 3, backgroundColor: C.blue },
  boxLabel: { fontSize: 8.5, fontFamily: B, color: C.blue, lineHeight: 0.85 },
  boxMain: { fontSize: 12, fontFamily: B, color: C.navy, lineHeight: 1.05, marginTop: 0.6 },
  boxSub: { fontSize: 8.5, fontFamily: B, color: C.muted, marginTop: 1.4 },

  // Section headings: 9.5pt blue, 51pt bar 17.5pt under the text top.
  h: { fontSize: 9.5, fontFamily: B, color: C.blue, marginTop: 11.3, marginLeft: IN },
  bar: { width: 51, height: 2, backgroundColor: C.blue, marginTop: 4.4, marginLeft: IN, marginBottom: 8.5 },
  bigH: { fontSize: 13, fontFamily: B, color: C.navy, marginLeft: IN, marginTop: 0.4 },
  bigBar: { width: 62.3, height: 2, backgroundColor: C.blue, marginTop: 4.2, marginLeft: IN, marginBottom: 8.4 },
  para: { fontSize: 9.5, lineHeight: 1.474, marginHorizontal: IN, color: C.text },
  intro: { fontSize: 9.3, lineHeight: 1.452, marginHorizontal: IN, color: C.text },

  // Service cards.
  cards: { marginTop: -1.4 },
  card: { borderWidth: 0.75, borderColor: C.line, paddingTop: 9.6, paddingBottom: 6.2, paddingLeft: 11.6, paddingRight: 44.3, marginBottom: 5.7, position: "relative" },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 9.6 },
  tag: { width: 73.7, height: 17.1, paddingBottom: 2.2, backgroundColor: C.tint, marginRight: 5.6, justifyContent: "center" },
  tagText: { color: C.blue, fontSize: 7.5, fontFamily: B, textAlign: "center" },
  cardTitle: { fontSize: 11.5, fontFamily: B, color: C.navy, paddingTop: 1 },
  cardNo: { position: "absolute", top: 14.1, right: 4.6, fontSize: 20, fontFamily: B, color: C.ghost },
  point: { fontSize: 9.3, lineHeight: 1.45, paddingLeft: 10, color: C.text },
  fee: { height: 23, backgroundColor: C.tint, justifyContent: "center", paddingHorizontal: 8, marginTop: 4.8 },
  feeText: { color: C.blue, fontFamily: B, fontSize: 10 },

  // Scope of work.
  secTitle: { fontSize: 10.2, fontFamily: B, color: C.navy, marginTop: 10, marginBottom: 5.9, marginHorizontal: IN },
  sp: { fontSize: 9, lineHeight: 1.444, marginHorizontal: IN, color: C.text },
  sh: { fontSize: 8.9, fontFamily: B, color: C.head, lineHeight: 1.438, marginLeft: IN + 11 },
  sb: { fontSize: 8.9, lineHeight: 1.438, marginLeft: IN + 11, color: C.text },
  ss: { fontSize: 8.7, lineHeight: 1.414, marginLeft: IN + 22, color: C.sub },
  sn: { fontSize: 8.7, fontFamily: I, lineHeight: 1.437, marginHorizontal: IN, color: C.muted },

  // Pricing summary.
  thRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.navy, height: 28, marginTop: 1.9, paddingBottom: 1, paddingHorizontal: 10 },
  th: { color: "#ffffff", fontSize: 8.5, fontFamily: B },
  tr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 28, paddingHorizontal: 10, borderTopWidth: 0.5, borderColor: C.rule },
  trTall: { height: 40 },
  trName: { fontSize: 9, fontFamily: B, color: C.muted },
  trNote: { fontSize: 8, color: C.muted, marginTop: 2.6 },
  trAmt: { fontSize: 10, fontFamily: B, color: C.navy },
  totRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.tint, height: 28, paddingTop: 2, paddingHorizontal: 10, borderTopWidth: 0.5, borderColor: C.rule },
  totLabel: { fontSize: 11, fontFamily: B, color: C.navy },
  totAmt: { fontSize: 12, fontFamily: B, color: C.blue },
  formula: { fontSize: 8, fontFamily: I, color: C.muted, marginTop: 3.9, marginLeft: IN },

  // Steps (three columns of 168pt starting 4pt inside the margin).
  stepsBlock: { marginTop: 6.3 },
  steps: { flexDirection: "row", marginLeft: 4, marginTop: 6.4 },
  step: { width: 168.1, minWidth: 168.1, flexShrink: 0, flexGrow: 0, paddingRight: 14 },
  stepNo: { fontSize: 16, fontFamily: B, color: C.ghost, lineHeight: 0.9 },
  stepTitle: { fontSize: 9.5, fontFamily: B, color: C.navy, lineHeight: 1.1, marginTop: -1.1 },
  stepText: { fontSize: 8.5, color: C.muted, lineHeight: 1.353 },
  stepBody: { marginTop: 1.5 },

  // Terms + signatures.
  term: { fontSize: 9, lineHeight: 1.444, marginHorizontal: IN, color: C.text },
  closing: { fontSize: 9.3, fontFamily: I, color: C.muted, marginTop: 8.4, marginHorizontal: IN },
  termsBlock: { marginTop: 5.9 },
  termList: { marginTop: 2.8 },
  signs: { flexDirection: "row", marginTop: 16.2, height: 80, backgroundColor: C.grey },
  sign: { flex: 1, paddingTop: 10.6, paddingHorizontal: 10 },
  signSplit: { borderLeftWidth: 0.5, borderColor: C.line, paddingLeft: 9.7 },
  signLabel: { fontSize: 8.5, fontFamily: B, color: C.blue, lineHeight: 0.85 },
  signName: { fontSize: 11, fontFamily: B, color: C.navy, lineHeight: 1.1, marginTop: 1.5 },
  signLine: { fontSize: 8, color: C.muted, marginTop: 17.1, lineHeight: 1.25 },
  signCap: { fontSize: 8, color: C.muted },
});

Font.register({ family: ARROW_FONT, src: path.join(process.cwd(), "src", "lib", "fonts", "arrow.ttf") });

/** Splits out "→" so it prints from the arrow font (Helvetica has no arrow). */
const withArrows = (runs: Run[]): Run[] =>
  runs.flatMap((r) =>
    r.text.split(/(→)/).filter(Boolean).map((t) => (t === "→" ? { text: t, font: ARROW_FONT as FontName } : { text: t, font: r.font }))
  );

/** Text wrapped the way the template wraps it: one <Text> per line, so react-pdf never re-breaks it.
    Like the template, a paragraph's first line is never left alone at the bottom of a page. */
function RunPara({ runs, style, size, width }: { runs: Run[]; style: Style; size: number; width: number }) {
  const lines = wrapRuns(withArrows(runs), size, width).map((line, i) => (
    <Text key={i} style={style}>
      {line.map((r, k) => (
        <Text key={k} style={{ fontFamily: r.font }}>{r.text}</Text>
      ))}
    </Text>
  ));
  return (
    <View>
      <View wrap={false}>{lines.slice(0, 2)}</View>
      {lines.slice(2)}
    </View>
  );
}

function Para({ text, style, size, width, font = R }: { text: string; style: Style; size: number; width: number; font?: FontName }) {
  return <RunPara runs={[{ text, font }]} style={style} size={size} width={width} />;
}

// Line widths available to each kind of text (template: body text runs to the right margin, sub-points stop 28pt short).
const WIDTH = {
  para: W - IN,
  bullet: W - (IN + 11),
  sub: W - IN - 22 - (IN + 22),
  point: W - 1.5 - 11.6 - 44.3 - 10,
  step: 168.1 - 14,
};

/** One line of a scope section, styled as in the template. */
function ScopeBlockView({ b }: { b: ScopeBlock }) {
  if (b.kind === "bullet") return <Para text={`•  ${T(b.text, true)}`} style={s.sb} size={8.9} width={WIDTH.bullet} />;
  if (b.kind === "sub") return <Para text={`–  ${T(b.text, true)}`} style={s.ss} size={8.7} width={WIDTH.sub} />;
  if (b.kind === "heading") return <Text style={s.sh} minPresenceAhead={20}>{T(b.text)}</Text>;
  if (b.kind === "note") return <Para text={T(b.text, true)} style={s.sn} size={8.7} width={WIDTH.para} font={I} />;
  return <Para text={T(b.text, true)} style={s.sp} size={9} width={WIDTH.para} />;
}

/** A paragraph that introduces a list stays on the same page as the list's first point. */
function groupBlocks(blocks: ScopeBlock[]) {
  const out: ScopeBlock[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.kind === "p" && next && (next.kind === "bullet" || next.kind === "heading")) {
      out.push([b, next]);
      i++;
    } else out.push([b]);
  }
  return out;
}

type Q = Quotation & { items: LineItem[]; createdBy?: { firstName: string; lastName: string } | null };

async function logo() {
  try {
    return await readFile(path.join(process.cwd(), "public", "logo-quotation.jpg"));
  } catch {
    return null; // logo missing on this server: the header shows the name only
  }
}

function Heading({ children, big }: { children: string; big?: boolean }) {
  return (
    <View minPresenceAhead={70} wrap={false}>
      <Text style={big ? s.bigH : s.h}>{children}</Text>
      <View style={big ? s.bigBar : s.bar} />
    </View>
  );
}

function QuotationPdf({ q, settings, icon }: { q: Q; settings: Settings; icon: Buffer | null }) {
  const m = (n: number) => rupees(n, q.currency);
  const legal = T(settings.company_legal_name || settings.company_name);
  const email = settings.company_email || DEFAULT_SETTINGS.company_email;
  const contact = [settings.company_website || DEFAULT_SETTINGS.company_website, email].filter(Boolean).map((c) => T(c));
  const tagline = T(settings.company_tagline).replace(/,/g, "").toUpperCase();
  const client = T(q.clientName);
  const date = slashDate(q.date);
  const sections = asSections(q.scope).filter((x) => x.title || x.body);
  const steps = asSteps(q.steps).filter((x) => x.title);
  const factor = q.subtotal > 0 ? (q.subtotal - q.discountTotal) / q.subtotal : 1;
  const taxes: Record<string, number> = {};
  for (const i of q.items) if (i.taxRate) taxes[i.taxRate] = (taxes[i.taxRate] || 0) + i.qty * i.rate * factor * (i.taxRate / 100);
  const plain = q.discountTotal === 0 && q.taxTotal === 0 && q.adjustment === 0;
  // Fee lines first (as in the template), then validity, then BDE's own terms.
  const feeLabel = (t: string) => (/\b(fee|fees|charges?|cost)$/i.test(t.trim()) ? t.trim() : `${t.trim()} Fee`);
  const terms = [
    ...q.items.map((i) => ({ label: feeLabel(T(i.description)), text: `${m(i.qty * i.rate)}.` })),
    ...(q.validUntil ? [{ label: "Validity", text: `This quotation is valid until ${slashDate(q.validUntil)}.` }] : []),
    ...parseTerms(q.terms).map((t) => ({ label: T(t.label), text: T(t.text) })),
  ];
  // Formula under the total uses short names, e.g. "Domain & Hosting Charges" → "Domain & Hosting".
  const shortName = (t: string) => T(t).replace(/\s+(charges?|fees?|cost)$/i, "");

  return (
    <Document title={`Quotation ${docNumber(q.prefix, q.number)} - ${client}`} author={legal} subject={T(q.subject)}>
      <Page size="A4" style={s.page}>
        {/* Footer band and the running header come first: they're absolutely positioned and repeat on every page. */}
        <View style={s.foot} fixed>
          <Text style={s.footL}>{`${legal.toUpperCase()}${tagline ? `  |  ${tagline}` : ""}`}</Text>
          <Text style={s.footR}>{contact.join("  |  ")}</Text>
        </View>
        <View
          fixed
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={s.run}>
                <View style={s.brand}>
                  {icon ? <Image src={icon} style={s.runLogo} /> : null}
                  <Text style={s.runName}>{legal.toUpperCase()}</Text>
                </View>
                <Text style={s.runRight}>{`QUOTATION FOR ${client.toUpperCase()}  ·  ${date}`}</Text>
              </View>
            ) : null
          }
        />

        {/* ── Page 1 ── */}
        <View style={s.head}>
          <View style={s.brand}>
            {icon ? <Image src={icon} style={s.logo} /> : null}
            <View>
              <Text style={s.brandName}>{T(settings.company_name).toUpperCase()}</Text>
              <View style={s.brandLines}>
                {contact.map((c) => <Text key={c} style={s.brandLine}>{c}</Text>)}
              </View>
            </View>
          </View>
          <View style={s.titleCol}>
            <Text style={s.title}>QUOTATION</Text>
            <Text style={s.date}>Date {date}</Text>
          </View>
        </View>

        <View style={s.boxes} wrap={false}>
          <View style={s.boxL}>
            <Text style={s.boxLabel}>PREPARED FOR</Text>
            <Text style={s.boxMain}>{client.toUpperCase()}</Text>
            <Text style={s.boxSub}>{T(q.clientCompany) || "Client"}</Text>
          </View>
          <View style={s.boxR}>
            <View style={s.boxEdge} />
            <Text style={s.boxLabel}>QUOTATION FOR</Text>
            <Text style={s.boxMain}>{T(q.subject)}</Text>
            {q.subtitle ? <Text style={s.boxSub}>{T(q.subtitle)}</Text> : null}
          </View>
        </View>

        {q.intro ? (
          <>
            <Heading>ENGAGEMENT OVERVIEW</Heading>
            <Para text={T(q.intro, true)} style={s.para} size={9.5} width={WIDTH.para} />
          </>
        ) : null}

        <Heading>SCOPE OF SERVICES & PRICING</Heading>
        <View style={s.cards}>
          {q.items.map((i, k) => (
            <View key={i.id} style={s.card} wrap={false}>
              <View style={s.cardTop}>
                {i.tag ? (
                  <View style={s.tag}>
                    <Text style={s.tagText}>{T(i.tag)}</Text>
                  </View>
                ) : null}
                <Text style={s.cardTitle}>{T(i.description)}</Text>
              </View>
              {servicePoints(i.longDescription).map((p, n) => (
                <Para key={n} text={`•  ${T(p, true)}`} style={s.point} size={9.3} width={WIDTH.point} />
              ))}
              <View style={s.fee}>
                <Text style={s.feeText}>{`Fee — ${m(i.qty * i.rate)}${i.taxRate ? ` + ${i.taxRate}% GST` : ""}`}</Text>
              </View>
              <Text style={s.cardNo}>{String(k + 1).padStart(2, "0")}</Text>
            </View>
          ))}
        </View>

        {/* ── Scope of work (new page) ── */}
        {sections.length > 0 || q.scopeIntro ? (
          <View break>
            <Heading big>SCOPE OF WORK</Heading>
            {q.scopeIntro ? (
              <View style={{ marginBottom: 1.5 }}>
                <Para text={T(q.scopeIntro, true)} style={s.intro} size={9.3} width={WIDTH.para} />
              </View>
            ) : null}
            {sections.map((sec, n) => (
              <View key={n}>
                {sec.title ? <Text style={s.secTitle} minPresenceAhead={40}>{`${n + 1}. ${T(sec.title)}`}</Text> : null}
                {groupBlocks(parseScopeBody(sec.body)).map((g, j) =>
                  g.length > 1 ? (
                    <View key={j} wrap={false}>
                      {g.map((b, k) => <ScopeBlockView key={k} b={b} />)}
                    </View>
                  ) : (
                    <ScopeBlockView key={j} b={g[0]} />
                  )
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Pricing summary ── */}
        <View wrap={false} style={{ marginTop: -1.3 }}>
          <Heading>PRICING SUMMARY</Heading>
          <View style={s.thRow}>
            <Text style={s.th}>SERVICE</Text>
            <Text style={s.th}>AMOUNT</Text>
          </View>
          {q.items.map((i, k) => (
            <View key={i.id} style={[s.tr, i.note ? s.trTall : {}, { backgroundColor: k % 2 ? C.grey : "#ffffff", borderTopWidth: k === 0 ? 0 : 0.5 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.trName}>{T(i.description)}</Text>
                {i.note ? <Text style={s.trNote}>{T(i.note)}</Text> : null}
              </View>
              <Text style={s.trAmt}>{m(i.qty * i.rate)}</Text>
            </View>
          ))}
          {q.discountTotal > 0 ? (
            <View style={s.tr}>
              <Text style={s.trName}>{`Discount (${q.discountPercent}%)`}</Text>
              <Text style={s.trAmt}>{`- ${m(q.discountTotal)}`}</Text>
            </View>
          ) : null}
          {Object.entries(taxes).map(([rate, amt]) => (
            <View key={rate} style={s.tr}>
              <Text style={s.trName}>{`GST ${rate}%`}</Text>
              <Text style={s.trAmt}>{m(round2(amt))}</Text>
            </View>
          ))}
          {q.adjustment ? (
            <View style={s.tr}>
              <Text style={s.trName}>Adjustment</Text>
              <Text style={s.trAmt}>{m(q.adjustment)}</Text>
            </View>
          ) : null}
          <View style={s.totRow}>
            <Text style={s.totLabel}>TOTAL AMOUNT</Text>
            <Text style={s.totAmt}>{m(q.total)}</Text>
          </View>
          {plain && q.items.length > 1 && q.items.length <= 5 ? (
            <Text style={s.formula}>{`${q.items.map((i) => `${m(i.qty * i.rate)} (${shortName(i.description)})`).join(" + ")} = ${m(q.total)}`}</Text>
          ) : null}
        </View>

        {/* ── Next steps ── */}
        {steps.length > 0 ? (
          <View wrap={false} style={s.stepsBlock}>
            <Heading>ACCEPTANCE & NEXT STEPS</Heading>
            <View style={s.steps}>
              {steps.map((st, n) => (
                <View key={n} style={s.step}>
                  <Text style={s.stepNo}>{String(n + 1).padStart(2, "0")}</Text>
                  <Text style={s.stepTitle}>{T(st.title)}</Text>
                  {st.text ? (
                    <View style={s.stepBody}>
                      <Para text={T(st.text, true)} style={s.stepText} size={8.5} width={WIDTH.step} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Terms, closing, signatures ── */}
        <View wrap={false} style={s.termsBlock}>
          <Heading>TERMS & CONDITIONS</Heading>
          <View style={s.termList}>
          {terms.map((t, n) => (
            <RunPara
              key={n}
              style={s.term}
              size={9}
              width={WIDTH.para}
              runs={t.label ? [{ text: `${t.label.replace(/[.:]$/, "")}.`, font: B }, { text: ` ${t.text}`, font: R }] : [{ text: t.text, font: R }]}
            />
          ))}
          </View>
          {q.closing ? <Text style={s.closing}>{T(q.closing)}</Text> : null}
        </View>

        <View style={s.signs} wrap={false}>
          <View style={s.sign}>
            <Text style={s.signLabel}>FOR</Text>
            <Text style={s.signName}>{legal}</Text>
            <Text style={s.signLine}>_______________________</Text>
            <Text style={s.signCap}>Authorised Signatory · Date</Text>
          </View>
          <View style={[s.sign, s.signSplit]}>
            <Text style={s.signLabel}>ACCEPTED BY</Text>
            <Text style={s.signName}>{T(q.clientCompany) || client}</Text>
            <Text style={s.signLine}>_______________________</Text>
            <Text style={s.signCap}>Authorised Signatory · Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function quotationPdf(q: Q, settings: Settings) {
  return renderToBuffer(<QuotationPdf q={q} settings={settings} icon={await logo()} />);
}
