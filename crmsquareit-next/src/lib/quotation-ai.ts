import "server-only";
import { chatJson } from "./ai";
import type { QuotationDraft } from "./quotation-content";

/* Turns a BDE's rough notes (or a half-written quotation) into content laid out exactly like the
   Squareit template: short service cards, numbered scope sections in the form's markup, three
   steps, "Label: text" terms. The model writes; normalize() enforces the format whatever it returns. */

const SYSTEM = `You write client quotations for Squareit Solutions, a digital agency in India (websites, apps, SEO, social media, ads, branding, hosting).
Turn the sales notes into a polished, professional quotation in Squareit's house format. Reply with ONE JSON object only, no other text.

JSON shape:
{
  "subject": "What is being quoted, 2-5 words, Title Case. e.g. Website Development",
  "subtitle": "One short line under it, e.g. Doctor / clinic website",
  "client": { "name": "", "company": "", "email": "", "phone": "", "address": "" },
  "intro": "1-2 sentences: This quotation covers <subject> for <client>, designed to <main outcome>. The full scope of work, pricing and terms are detailed below.",
  "services": [
    { "tag": "DEV", "title": "Website Development", "points": ["Design and development of the website", "Delivery timeline: 10–15 Days"], "fee": 6000, "note": "Timeline: 10–15 Days" }
  ],
  "scopeIntro": "One paragraph (2-3 sentences) describing the overall deliverable and its goals.",
  "scope": [
    { "title": "Website Architecture", "body": "The site will have a clear structure:\\n- Home\\n- About\\n- Services\\n-- Service A, Service B, Service C\\n- Contact" }
  ],
  "steps": [
    { "title": "Confirm Scope", "text": "Approve this quotation in writing to lock the deliverables and fee." },
    { "title": "Onboarding", "text": "Share content, branding assets and any access we need." },
    { "title": "Go Live", "text": "Work begins and is delivered within 10–15 days." }
  ],
  "terms": [ { "label": "Delivery Timeline", "text": "10–15 Days from confirmation of scope." } ],
  "closing": "Thank you for the opportunity. We look forward to partnering with you."
}

Rules:
- Use only facts from the notes. Never invent prices: if a fee is not stated (and not in the price list), use 0.
- Amounts are in Indian Rupees as plain numbers (6000, not "Rs. 6,000"). "6k" = 6000, "1.5 lakh" = 150000.
- services: one card per priced item (usually 1-4). tag = 2-6 UPPERCASE letters (DEV, HOST, SEO, SMM, APP, ADS, LOGO, AMC). points = 2-4 short phrases, no full stops. note = short line for the pricing table (often the timeline) or "".
- scope: 4-13 sections for a detailed project, fewer for small jobs, [] for a one-line job. Section titles have no numbers.
  Each body uses this markup, one item per line:
    "- text" bullet point | "-- text" sub-point under the previous bullet | "## text" small heading | "> text" note in italics | plain line = paragraph.
  Typical body: one intro sentence ending with ":" then 3-7 bullets. Keep bullets under 20 words.
- steps: exactly 3, titles of 1-3 words.
- terms: practical terms (payment, delivery timeline, revisions, validity...). Do NOT add fee or total lines; they are added automatically.
- Professional, confident British/Indian English. Fix spelling and grammar. Translate Hindi/Hinglish to English.
- Use "–" for ranges (10–15 Days) and "→" for flows (Problem → Diagnosis → Treatment).`;

const POLISH = `The user already wrote a quotation draft (JSON below). Rewrite it into the house format: keep every fact, price and service,
fix grammar, tighten wording, split long text into bullet points using the markup, add missing tags/notes, and fill in empty parts only where the
facts allow. Keep the same services in the same order with the same fees.`;

export async function draftQuotation(input: { notes: string; current?: Partial<QuotationDraft>; catalog: { name: string; rate: number }[]; mode: "draft" | "polish" }) {
  const parts: string[] = [];
  if (input.catalog.length)
    parts.push(`Squareit's standard price list (use these when the notes name a service without a price):\n${input.catalog.map((c) => `- ${c.name}: ${c.rate}`).join("\n")}`);
  if (input.mode === "polish") {
    parts.push(POLISH, `Current draft:\n${JSON.stringify(input.current ?? {}, null, 1)}`);
    if (input.notes.trim()) parts.push(`Extra notes from the salesperson:\n${input.notes.trim()}`);
  } else {
    parts.push(`Sales notes:\n${input.notes.trim()}`);
    const known = input.current?.client;
    if (known?.name) parts.push(`The quotation is for: ${known.name}${known.company ? `, ${known.company}` : ""}.`);
  }
  const raw = await chatJson(SYSTEM, parts.join("\n\n"));
  return normalize(raw);
}

/* ── Format enforcement ─────────────────────────────────────────────────── */

// Models like non-breaking hyphens/spaces; Helvetica in the PDF can't print them.
const plainChars = (s: string) => s.replace(/[‐‑]/g, "-").replace(/[  ]/g, " ");
const str = (v: unknown, max = 2000) => plainChars(typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, max);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lines = (v: unknown) =>
  (Array.isArray(v) ? v.map((x) => str(x)) : typeof v === "string" ? plainChars(v).split(/\r?\n/) : []).map((l) => l.trim()).filter(Boolean);

/** "Rs. 6,000/-", "6k", "₹1.5 lakh" → 6000 / 150000. */
export function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
  const t = str(v).toLowerCase().replace(/,/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lakh|lakhs|cr|crore)?\b/);
  if (!m) return 0;
  const mult = { k: 1e3, thousand: 1e3, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7 }[m[2] ?? ""] ?? 1;
  return Math.round(Number(m[1]) * mult * 100) / 100;
}

const TAGS: [RegExp, string][] = [
  [/domain|hosting|server/i, "HOST"],
  [/\bseo\b|search engine/i, "SEO"],
  [/social|instagram|facebook|smm/i, "SMM"],
  [/\b(ads?|ppc|google ads|meta ads|campaign)\b/i, "ADS"],
  [/\bapp\b|android|ios|mobile application/i, "APP"],
  [/logo|brand/i, "BRAND"],
  [/maintenance|amc|support/i, "AMC"],
  [/content|copy|blog/i, "CONTENT"],
  [/e-?commerce|shop|store/i, "SHOP"],
  [/design|ui|ux/i, "DESIGN"],
  [/web|site|develop/i, "DEV"],
];
const tagFor = (title: string, given: string) => {
  const t = given.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (t) return t;
  return TAGS.find(([re]) => re.test(title))?.[1] ?? title.split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
};

const titleCase = (s: string) => (s && s === s.toLowerCase() ? s.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s);
const noStop = (s: string) => s.replace(/[.;]+$/, "");
const ranges = (s: string) => s.replace(/(\d)\s*-\s*(\d)/g, "$1–$2").replace(/\s*-+>\s*/g, " → ");

/** Normalizes one scope body line to the editor's markup ("- ", "-- ", "## ", "> ", plain). */
function markupLine(raw: string): string {
  const l = ranges(raw.trim());
  const after = (re: RegExp) => l.replace(re, "").trim();
  if (/^(--|–|—)\s*/.test(l)) return `-- ${after(/^(--|–|—)\s*/)}`;
  if (/^(\d+[.)]|[-•*●▪])\s+/.test(l)) return `- ${after(/^(\d+[.)]|[-•*●▪])\s+/)}`;
  if (/^#+/.test(l)) return `## ${after(/^#+/)}`;
  if (/^\*\*(.+)\*\*:?$/.test(l)) return `## ${l.replace(/^\*\*(.+)\*\*:?$/, "$1")}`;
  if (/^>/.test(l)) return `> ${after(/^>/)}`;
  return l.replace(/\*\*/g, "");
}

export function normalize(raw: unknown): QuotationDraft {
  const r = obj(raw);
  const c = obj(r.client);
  const services = arr(r.services)
    .map(obj)
    .map((x) => {
      const title = titleCase(str(x.title ?? x.name ?? x.service, 200));
      return {
        tag: tagFor(title, str(x.tag)),
        title,
        points: lines(x.points ?? x.includes ?? x.description)
          .map((p) => noStop(ranges(p.replace(/^[-•*]\s*/, ""))))
          .slice(0, 8)
          .join("\n"),
        fee: money(x.fee ?? x.price ?? x.amount),
        note: ranges(str(x.note, 120)),
        taxRate: 0,
      };
    })
    .filter((x) => x.title)
    .slice(0, 12);

  const scope = arr(r.scope)
    .map(obj)
    .map((x) => ({
      title: titleCase(str(x.title, 120).replace(/^\d+[.)]\s*/, "")),
      body: lines(x.body ?? x.points ?? x.content).map(markupLine).filter(Boolean).join("\n"),
    }))
    .filter((x) => x.title || x.body)
    .slice(0, 20);

  const steps = arr(r.steps)
    .map(obj)
    .map((x) => ({ title: str(x.title, 40), text: ranges(str(x.text ?? x.description, 200)) }))
    .filter((x) => x.title)
    .slice(0, 3);

  // Fees and the total are printed from the services, so drop any the model repeats here.
  const terms = arr(r.terms)
    .map((t) => (typeof t === "string" ? { label: t.includes(":") ? t.slice(0, t.indexOf(":")) : "", text: t.includes(":") ? t.slice(t.indexOf(":") + 1) : t } : obj(t)))
    .map((t) => ({ label: str(t.label, 60).replace(/[.:]+$/, ""), text: ranges(str(t.text, 300)) }))
    .filter((t) => t.text && !/\b(fee|charges?|total|amount|price)\b/i.test(t.label))
    .slice(0, 10)
    .map((t) => (t.label ? `${t.label}: ${t.text}` : t.text))
    .join("\n");

  return {
    subject: titleCase(str(r.subject, 120)),
    subtitle: str(r.subtitle, 120),
    client: { name: str(c.name, 120), company: str(c.company, 120), email: str(c.email, 120), phone: str(c.phone, 40), address: str(c.address, 300) },
    intro: ranges(str(r.intro, 600)),
    services,
    scopeIntro: ranges(str(r.scopeIntro, 1200)),
    scope,
    steps,
    terms,
    closing: str(r.closing, 200),
  };
}
