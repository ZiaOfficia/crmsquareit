"use client";
import { useRef, useState, useTransition } from "react";
import { ClipboardList, LoaderCircle, Sparkles, Undo2, WandSparkles } from "lucide-react";
import { btn } from "@/components/ui";
import { QUOTATION_FILL_EVENT, type QuotationDraft, type QuotationFill } from "@/lib/quotation-content";
import { aiQuotationDraft } from "./ai-actions";
import { QUOTATION_EXAMPLES } from "./examples";

/* AI assistant at the top of the quotation form.
   "Write quotation" turns rough notes into every section of the form, in the PDF's format.
   "Polish" rewrites what's already in the form into that format. Nothing is saved until the BDE saves. */

const TEXT_FIELDS = ["subject", "subtitle", "intro", "scopeIntro", "terms", "closing"] as const;

const EXAMPLE = `Dr. Farhan Ahmad, orthopaedic surgeon at H.M. Surgical Hospital, Azamgarh. Wants a website for his practice.
Pages: home, about doctor, services (knee replacement, ACL surgery, fractures...), conditions, case studies, reviews, contact/appointment.
Needs WhatsApp + call buttons, appointment form, videos, SEO for Azamgarh. Mobile friendly.
Website 6000, domain + hosting 3000. Delivery 10-15 days. 50% advance.`;

function readJson<T>(form: HTMLFormElement, name: string, fallback: T): T {
  const el = form.elements.namedItem(name);
  try {
    return el instanceof HTMLInputElement ? (JSON.parse(el.value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function value(form: HTMLFormElement, name: string) {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el.value : "";
}

/** Everything currently in the form, in the AI's shape. Also used to undo a fill. */
function snapshot(form: HTMLFormElement): QuotationDraft {
  return {
    subject: value(form, "subject"),
    subtitle: value(form, "subtitle"),
    client: { name: value(form, "clientName"), company: value(form, "clientCompany"), email: value(form, "clientEmail"), phone: value(form, "clientPhone"), address: value(form, "clientAddress") },
    intro: value(form, "intro"),
    services: readJson(form, "services", []),
    scopeIntro: value(form, "scopeIntro"),
    scope: readJson(form, "scope", []),
    steps: readJson(form, "steps", []),
    terms: value(form, "terms"),
    closing: value(form, "closing"),
  };
}

/** Puts a draft into the form. `replace` writes every field (undo); otherwise empty AI answers keep what's there. */
function apply(form: HTMLFormElement, d: QuotationDraft, replace: boolean) {
  for (const k of TEXT_FIELDS) {
    const el = form.elements.namedItem(k);
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && (replace || d[k])) el.value = d[k];
  }
  const fill: QuotationFill = {
    client: d.client,
    clientOverwrite: replace,
    ...(replace || d.services.length ? { services: d.services } : {}),
    ...(replace || d.scope.length ? { scope: d.scope } : {}),
    ...(replace || d.steps.length ? { steps: d.steps } : {}),
  };
  window.dispatchEvent(new CustomEvent(QUOTATION_FILL_EVENT, { detail: fill }));
}

export function AiAssist({ provider }: { provider: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [undo, setUndo] = useState<QuotationDraft | null>(null);
  const [busy, setBusy] = useState<"draft" | "polish" | null>(null);
  const [, start] = useTransition();
  const form = () => ref.current?.closest("form") ?? null;

  function run(mode: "draft" | "polish") {
    const f = form();
    if (!f) return;
    setError("");
    setDone("");
    const before = snapshot(f);
    setBusy(mode);
    start(async () => {
      const res = await aiQuotationDraft({ mode, notes, current: before }).catch(() => ({ error: "Couldn't reach the server. Check your connection and try again." }));
      setBusy(null);
      if (res.error !== undefined || !("draft" in res) || !res.draft) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      apply(f, res.draft, false);
      setUndo(before);
      const missingFees = res.draft.services.filter((s) => !s.fee).length;
      setDone(
        `${mode === "draft" ? "Quotation drafted" : "Quotation polished"}: check each section below, then save.` +
          (missingFees ? ` ${missingFees === 1 ? "One service has" : `${missingFees} services have`} no fee yet. Add it before saving.` : "")
      );
    });
  }

  /** Fills every field with a complete sample quotation (no AI needed). */
  function fillExample(key: string) {
    const f = form();
    const ex = QUOTATION_EXAMPLES.find((x) => x.key === key);
    if (!f || !ex) return;
    setError("");
    setUndo(snapshot(f));
    apply(f, ex.draft, true);
    setDone(`Filled with the “${ex.label}” example: all sections, ${ex.draft.services.length} services. Edit anything, then save.`);
  }

  return (
    <div ref={ref} className="card overflow-hidden border-primary/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Sparkles className="h-4 w-4 text-primary" /> AI assist
        </h3>
        <span className="text-xs text-slate-400">Free open-source AI · {provider}</span>
      </div>
      <div className="space-y-3 p-5">
        <label className="block">
          <span className="label">Client requirements / call notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            maxLength={15000}
            placeholder={EXAMPLE}
            className="input"
            aria-describedby="ai-help"
          />
          <span id="ai-help" className="mt-1 block text-xs text-slate-400">
            Paste anything: a WhatsApp chat, an email, rough points, even Hinglish. The AI writes every section below in the Squareit quotation format.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => run("draft")} disabled={!!busy || notes.trim().length < 10} className={btn("primary")}>
            {busy === "draft" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy === "draft" ? "Writing…" : "Write quotation"}
          </button>
          <button type="button" onClick={() => run("polish")} disabled={!!busy} className={btn("secondary")} title="Rewrite what's already in the form into the quotation format">
            {busy === "polish" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
            {busy === "polish" ? "Polishing…" : "Polish what's in the form"}
          </button>
          {undo && !busy && (
            <button
              type="button"
              onClick={() => {
                const f = form();
                if (f) apply(f, undo, true);
                setUndo(null);
                setDone("Changes undone.");
              }}
              className={btn("ghost")}
            >
              <Undo2 className="h-4 w-4" /> Undo
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ClipboardList className="h-4 w-4" /> Autofill example
          </span>
          {QUOTATION_EXAMPLES.map((ex) => (
            <button key={ex.key} type="button" onClick={() => fillExample(ex.key)} disabled={!!busy} className={btn("secondary", "py-1.5 text-xs")}>
              {ex.label}
            </button>
          ))}
        </div>
        {busy && <p className="text-xs text-slate-500">This usually takes 5–20 seconds.</p>}
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
        {done && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{done}</div>}
      </div>
    </div>
  );
}
