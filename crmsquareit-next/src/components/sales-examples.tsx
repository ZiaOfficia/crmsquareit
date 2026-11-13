"use client";
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { SALES_EXAMPLE_EVENT, type EditorItem, type SalesExampleFill } from "./line-items";

/* Sample invoices / estimates for the "Fill example" buttons: items, discount and a client note,
   so anyone can see what goes where. The customer stays the user's pick (it must be a saved customer). */

type Example = { key: string; label: string; hint: string; items: EditorItem[]; discountPercent: number; adjustment: number; clientNote: string };

const EXAMPLES: Example[] = [
  {
    key: "website",
    label: "Website project",
    hint: "One-time website build with hosting, 18% GST on each item.",
    items: [
      { description: "Website development", longDescription: "10-page responsive website with CMS and contact forms", qty: 1, rate: 45000, unit: "project", taxRate: 18 },
      { description: "Domain & hosting", longDescription: "1 year, SSL included", qty: 1, rate: 6000, unit: "year", taxRate: 18 },
      { description: "Content writing", longDescription: "Copy for all pages", qty: 10, rate: 800, unit: "page", taxRate: 18 },
    ],
    discountPercent: 5,
    adjustment: 0,
    clientNote: "Thank you for choosing Squareit Solutions. The balance is due on handover of the website.",
  },
  {
    key: "retainer",
    label: "Monthly marketing retainer",
    hint: "Recurring services billed per month, no discount.",
    items: [
      { description: "Social media management", longDescription: "Instagram + Facebook, 16 posts and 4 reels a month", qty: 1, rate: 25000, unit: "month", taxRate: 18 },
      { description: "Google Ads management", longDescription: "Campaign setup, optimisation and monthly report", qty: 1, rate: 15000, unit: "month", taxRate: 18 },
    ],
    discountPercent: 0,
    adjustment: 0,
    clientNote: "Retainer for the month. Ad spend is billed by Google directly to your account.",
  },
  {
    key: "hourly",
    label: "Hourly support work",
    hint: "Hours × hourly rate, plus a fixed monthly charge.",
    items: [
      { description: "App bug fixing & support", longDescription: "Fixes reported in the support sheet", qty: 12, rate: 1500, unit: "hour", taxRate: 18 },
      { description: "Server maintenance", longDescription: "Updates, backups and monitoring", qty: 1, rate: 3500, unit: "month", taxRate: 18 },
    ],
    discountPercent: 0,
    adjustment: 0,
    clientNote: "Hours as per the attached timesheet.",
  },
];

export function SalesExamples({ kind }: { kind: "invoice" | "estimate" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<string | null>(null);

  function fill(e: Example | null) {
    const detail: SalesExampleFill = e ? { items: e.items, discountPercent: e.discountPercent, adjustment: e.adjustment } : { items: [], discountPercent: 0, adjustment: 0 };
    window.dispatchEvent(new CustomEvent(SALES_EXAMPLE_EVENT, { detail }));
    const note = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>('textarea[name="clientNote"]');
    if (note) note.value = e ? e.clientNote : "";
    setHint(e?.hint ?? null);
  }

  return (
    <div ref={ref} className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-slate-800">Not sure what goes where?</span>
        <span className="text-sm text-slate-600">Fill an example, then change the details:</span>
        {EXAMPLES.map((e) => (
          <button key={e.key} type="button" onClick={() => fill(e)} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
            {e.label}
          </button>
        ))}
        <button type="button" onClick={() => fill(null)} className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800">
          Clear
        </button>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-600">{hint} Replace the sample items before saving.</p>}
      <ol className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <li><b className="text-slate-700">Customer:</b> pick who you are billing (add them under Customers first).</li>
        <li><b className="text-slate-700">Dates:</b> {kind === "invoice" ? "invoice date and when payment is due." : "estimate date and until when it is valid."}</li>
        <li><b className="text-slate-700">Items:</b> qty × rate, with tax % per item. Pick a saved item to save typing.</li>
        <li><b className="text-slate-700">Discount / adjustment:</b> discount is % of the subtotal; adjustment adds or removes a fixed amount.</li>
      </ol>
    </div>
  );
}
