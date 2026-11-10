/** Quotation content helpers shared by the form (client) and the PDF (server). No DB access here. */

export type Service = { tag: string; title: string; points: string; fee: number; note: string; taxRate: number };
export type ScopeSection = { title: string; body: string };
export type Step = { title: string; text: string };

/** What the AI assistant returns: every part of the quotation form, already in the house format. */
export type QuotationDraft = {
  subject: string;
  subtitle: string;
  client: { name: string; company: string; email: string; phone: string; address: string };
  intro: string;
  services: Service[];
  scopeIntro: string;
  scope: ScopeSection[];
  steps: Step[];
  /** "Label: text" lines */
  terms: string;
  closing: string;
};

/** Browser event the AI assistant uses to fill the quotation form's editors. */
export const QUOTATION_FILL_EVENT = "quotation:fill";
export type QuotationFill = Partial<Pick<QuotationDraft, "services" | "scope" | "steps">> & { client?: Partial<QuotationDraft["client"]>; clientOverwrite?: boolean };

/** How BDE formats a scope section's text. Shown as help next to the editor. */
export const SCOPE_MARKUP_HELP = [
  ["- text", "bullet point"],
  ["-- text", "sub-point (indented)"],
  ["## text", "small heading"],
  ["> text", "note in italics"],
  ["anything else", "normal paragraph"],
] as const;

export type ScopeBlock = { kind: "p" | "bullet" | "sub" | "heading" | "note"; text: string };

export function parseScopeBody(body: string): ScopeBlock[] {
  const out: ScopeBlock[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("--")) out.push({ kind: "sub", text: line.replace(/^--\s*/, "") });
    else if (/^[-•*]\s*/.test(line)) out.push({ kind: "bullet", text: line.replace(/^[-•*]\s*/, "") });
    else if (line.startsWith("##")) out.push({ kind: "heading", text: line.replace(/^#+\s*/, "") });
    else if (line.startsWith(">")) out.push({ kind: "note", text: line.replace(/^>\s*/, "") });
    else out.push({ kind: "p", text: line });
  }
  return out;
}

/** "Label: text" lines → terms. A line without a colon is shown as plain text. */
export function parseTerms(text: string | null | undefined) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0 && i < 60 ? { label: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { label: "", text: l };
    });
}

/** "Title | text" lines (from settings) → steps. */
export const parseStepLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: title.trim(), text: rest.join("|").trim() };
    });

/** Bullet points of a service: one per line, leading "-" or "•" optional. */
export const servicePoints = (points: string | null | undefined) =>
  (points ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);

/** Safely read JSON arrays stored on the quotation. */
export function asSections(v: unknown): ScopeSection[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map((x) => ({ title: String(x.title ?? ""), body: String(x.body ?? "") })) : [];
}
export function asSteps(v: unknown): Step[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map((x) => ({ title: String(x.title ?? ""), text: String(x.text ?? "") })) : [];
}

/** "Rs. 6,000/-" (whole rupees) or "Rs. 6,000.50"; other currencies use their code. */
export function rupees(n: number, currency = "INR") {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const v = new Intl.NumberFormat("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(whole ? Math.round(n) : n);
  return currency === "INR" ? `Rs. ${v}${whole ? "/-" : ""}` : `${currency} ${v}`;
}

/** "22 / 09 / 2026" */
export const slashDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;

/** Fills {subject} and {client} in the default engagement overview. */
export const fillTemplate = (t: string, subject: string, client: string) => t.replaceAll("{subject}", subject || "the services discussed").replaceAll("{client}", client || "you");
