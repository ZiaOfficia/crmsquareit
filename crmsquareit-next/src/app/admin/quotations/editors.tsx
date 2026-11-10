"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { QUOTATION_FILL_EVENT, rupees, SCOPE_MARKUP_HELP, type QuotationFill, type ScopeSection, type Service, type Step } from "@/lib/quotation-content";

/** Runs `fn` when the AI assistant fills the form (see ai-assist.tsx). */
export function useQuotationFill(fn: (d: QuotationFill) => void) {
  useEffect(() => {
    const h = (e: Event) => fn((e as CustomEvent<QuotationFill>).detail);
    window.addEventListener(QUOTATION_FILL_EVENT, h);
    return () => window.removeEventListener(QUOTATION_FILL_EVENT, h);
  });
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function move<T>(list: T[], i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RowTools({ i, n, onMove, onRemove, label }: { i: number; n: number; onMove: (by: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onMove(-1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${label} up`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={i === n - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${label} down`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-brand-red" aria-label={`Remove ${label}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Services (the priced cards on page 1 + pricing summary) ───────────── */

type Saved = { id: number; description: string; longDescription: string | null; rate: number; taxRate: number };

export function ServicesEditor({
  initial,
  saved,
  taxRates,
  currency,
  initialDiscount = 0,
  initialAdjustment = 0,
}: {
  initial: Service[];
  saved: Saved[];
  taxRates: { label: string; rate: number }[];
  currency: string;
  initialDiscount?: number;
  initialAdjustment?: number;
}) {
  const blank: Service = { tag: "", title: "", points: "", fee: 0, note: "", taxRate: 0 };
  const [items, setItems] = useState<Service[]>(initial.length ? initial : [blank]);
  const [discount, setDiscount] = useState(initialDiscount);
  const [adjustment, setAdjustment] = useState(initialAdjustment);
  const set = (i: number, patch: Partial<Service>) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  useQuotationFill((d) => {
    if (d.services) setItems(d.services.length ? d.services : [blank]);
  });

  const t = useMemo(() => {
    const subtotal = r2(items.reduce((s, i) => s + (i.fee || 0), 0));
    const discountTotal = r2((subtotal * (discount || 0)) / 100);
    const factor = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 1;
    const tax = r2(items.reduce((s, i) => s + (i.fee || 0) * factor * ((i.taxRate || 0) / 100), 0));
    return { subtotal, discountTotal, tax, total: r2(subtotal - discountTotal + tax + (adjustment || 0)) };
  }, [items, discount, adjustment]);

  return (
    <div>
      <input type="hidden" name="services" value={JSON.stringify(items)} />
      <input type="hidden" name="discountPercent" value={discount} />
      <input type="hidden" name="adjustment" value={adjustment} />
      <div className="divide-y divide-slate-100">
        {items.map((it, i) => (
          <div key={i} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Service {String(i + 1).padStart(2, "0")}</span>
              <RowTools i={i} n={items.length} label={`service ${i + 1}`} onMove={(by) => setItems(move(items, i, by))} onRemove={() => setItems(items.length > 1 ? items.filter((_, k) => k !== i) : [blank])} />
            </div>
            <div className="grid gap-3 sm:grid-cols-6">
              <label className="block sm:col-span-1">
                <span className="label">Tag</span>
                <input value={it.tag} onChange={(e) => set(i, { tag: e.target.value.toUpperCase().slice(0, 8) })} placeholder="DEV" className="input uppercase" />
              </label>
              <label className="block sm:col-span-3">
                <span className="label">Service *</span>
                <input value={it.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Website Development" className="input" />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">Fee *</span>
                <input type="number" min={0} step="0.01" value={it.fee || ""} onChange={(e) => set(i, { fee: Number(e.target.value) || 0 })} placeholder="6000" className="input text-right" />
              </label>
              <label className="block sm:col-span-4">
                <span className="label">What's included (one point per line)</span>
                <textarea rows={3} value={it.points} onChange={(e) => set(i, { points: e.target.value })} placeholder={"Design and development of the website\nDelivery timeline: 10–15 Days"} className="input" />
              </label>
              <div className="space-y-3 sm:col-span-2">
                <label className="block">
                  <span className="label">Note in pricing summary</span>
                  <input value={it.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="Timeline: 10–15 Days" className="input" />
                </label>
                <label className="block">
                  <span className="label">GST / tax</span>
                  <select value={it.taxRate} onChange={(e) => set(i, { taxRate: Number(e.target.value) })} className="input">
                    <option value={0}>No tax</option>
                    {taxRates.map((r) => <option key={r.label} value={r.rate}>{r.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={() => setItems([...items, blank])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Plus className="h-4 w-4" /> Add service
        </button>
        {saved.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const s = saved.find((x) => String(x.id) === e.target.value);
              if (!s) return;
              const filled: Service = { tag: "", title: s.description, points: s.longDescription ?? "", fee: s.rate, note: "", taxRate: s.taxRate };
              // Replace the empty first row instead of adding below it.
              setItems(items.length === 1 && !items[0].title && !items[0].fee ? [filled] : [...items, filled]);
            }}
            className="input w-auto"
            aria-label="Add a saved service"
          >
            <option value="">+ Add a saved service…</option>
            {saved.map((s) => <option key={s.id} value={s.id}>{s.description} · {rupees(s.rate, currency)}</option>)}
          </select>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 p-5">
        <dl className="w-full max-w-sm space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{rupees(t.subtotal, currency)}</dd></div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Discount %</dt>
            <dd><input type="number" min={0} max={100} step="0.01" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="input w-24 py-1 text-right" placeholder="0" /></dd>
          </div>
          {t.tax > 0 && <div className="flex justify-between"><dt className="text-slate-500">GST / tax</dt><dd className="tabular-nums">{rupees(t.tax, currency)}</dd></div>}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Adjustment (+/−)</dt>
            <dd><input type="number" step="0.01" value={adjustment || ""} onChange={(e) => setAdjustment(Number(e.target.value) || 0)} className="input w-24 py-1 text-right" placeholder="0" /></dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-ink"><dt>Total</dt><dd className="tabular-nums">{rupees(t.total, currency)}</dd></div>
        </dl>
      </div>
    </div>
  );
}

/* ── Scope of work (numbered sections, pages 2+) ───────────────────────── */

const EXAMPLE_SCOPE: ScopeSection[] = [
  { title: "Website Architecture", body: "The site will have a clear structure that is easy for visitors and search engines to navigate:\n- Home\n- About\n- Services\n-- Service 1, Service 2, Service 3\n- Reviews\n- Contact" },
  { title: "Homepage Development", body: "The homepage will work as the main enquiry page.\n## Hero Section\n- Strong headline with a clear call to action\n- Primary CTA: enquiry form\n- Secondary CTA: Call Now / WhatsApp" },
  { title: "Mobile Optimization", body: "- Fully responsive, touch-friendly design\n- Sticky bottom CTA (Call | WhatsApp | Enquiry)\n> Most visitors arrive on a phone, so the mobile layout is designed first." },
  { title: "SEO-Friendly Development", body: "- SEO-friendly URLs, meta titles & descriptions, proper heading hierarchy\n- Image ALT text, internal linking, schema markup where appropriate" },
];

export function ScopeEditor({ initialIntro, initialSections }: { initialIntro: string; initialSections: ScopeSection[] }) {
  const [sections, setSections] = useState<ScopeSection[]>(initialSections);
  const set = (i: number, patch: Partial<ScopeSection>) => setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  useQuotationFill((d) => {
    if (d.scope) setSections(d.scope);
  });
  return (
    <div className="space-y-4 p-5">
      <input type="hidden" name="scope" value={JSON.stringify(sections.filter((s) => s.title.trim() || s.body.trim()))} />
      <label className="block">
        <span className="label">Opening paragraph</span>
        <textarea name="scopeIntro" rows={3} defaultValue={initialIntro} placeholder="Development of a modern, professional website for … designed to …" className="input" />
      </label>
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold">Formatting:</span>{" "}
        {SCOPE_MARKUP_HELP.map(([k, v], i) => (
          <span key={k}>
            {i > 0 && " · "}
            <code className="rounded bg-white px-1 text-slate-800">{k}</code> {v}
          </span>
        ))}
      </div>
      {sections.map((s, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-bold text-slate-400">{i + 1}.</span>
            <input value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Section heading, e.g. Website Architecture" className="input flex-1 font-semibold" />
            <RowTools i={i} n={sections.length} label={`section ${i + 1}`} onMove={(by) => setSections(move(sections, i, by))} onRemove={() => setSections(sections.filter((_, k) => k !== i))} />
          </div>
          <textarea rows={Math.min(14, Math.max(4, s.body.split("\n").length + 1))} value={s.body} onChange={(e) => set(i, { body: e.target.value })} placeholder={"Intro sentence…\n- Point one\n- Point two\n-- detail"} className="input font-mono text-[13px]" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSections([...sections, { title: "", body: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Plus className="h-4 w-4" /> Add section
        </button>
        {sections.length === 0 && (
          <button type="button" onClick={() => setSections(EXAMPLE_SCOPE)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-blue-50">
            Start from a website example
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">Leave this empty for a short quotation; the PDF then skips the Scope of Work pages.</p>
    </div>
  );
}

/* ── Acceptance & next steps ───────────────────────────────────────────── */

export function StepsEditor({ initial }: { initial: Step[] }) {
  const [steps, setSteps] = useState<Step[]>(initial);
  const set = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  useQuotationFill((d) => {
    if (d.steps) setSteps(d.steps);
  });
  return (
    <div className="space-y-3 p-5">
      <input type="hidden" name="steps" value={JSON.stringify(steps.filter((s) => s.title.trim()))} />
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-300">{String(i + 1).padStart(2, "0")}</span>
              <button type="button" onClick={() => setSteps(steps.filter((_, k) => k !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-brand-red" aria-label={`Remove step ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Step title" className="input mb-2 font-semibold" />
            <textarea rows={3} value={s.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="What happens in this step" className="input" />
          </div>
        ))}
      </div>
      {steps.length < 4 && (
        <button type="button" onClick={() => setSteps([...steps, { title: "", text: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Plus className="h-4 w-4" /> Add step
        </button>
      )}
    </div>
  );
}
