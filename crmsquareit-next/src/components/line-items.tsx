"use client";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";

export type EditorItem = { description: string; longDescription?: string | null; qty: number; rate: number; unit?: string | null; taxRate: number };
export type SalesExampleFill = { items: EditorItem[]; discountPercent: number; adjustment: number };
export const SALES_EXAMPLE_EVENT = "sales-example-fill";
type Saved = { id: number; description: string; longDescription: string | null; rate: number; unit: string | null; taxRate: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function LineItemsEditor({
  initial,
  savedItems,
  taxRates,
  initialDiscount = 0,
  initialAdjustment = 0,
  currency,
}: {
  initial: EditorItem[];
  savedItems: Saved[];
  taxRates: { label: string; rate: number }[];
  initialDiscount?: number;
  initialAdjustment?: number;
  currency: string;
}) {
  const blank: EditorItem = { description: "", longDescription: "", qty: 1, rate: 0, unit: "", taxRate: taxRates[0]?.rate ?? 0 };
  const [items, setItems] = useState<EditorItem[]>(initial.length ? initial : [blank]);
  const [discount, setDiscount] = useState(initialDiscount);
  const [adjustment, setAdjustment] = useState(initialAdjustment);
  // "Fill example" buttons (sales-examples.tsx) send a full set of items.
  useEffect(() => {
    const onFill = (e: Event) => {
      const d = (e as CustomEvent<SalesExampleFill>).detail;
      setItems(d.items.length ? d.items.map((i) => ({ ...i })) : [blank]);
      setDiscount(d.discountPercent);
      setAdjustment(d.adjustment);
    };
    window.addEventListener(SALES_EXAMPLE_EVENT, onFill);
    return () => window.removeEventListener(SALES_EXAMPLE_EVENT, onFill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };

  const totals = useMemo(() => {
    const subtotal = r2(items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0));
    const discountTotal = r2((subtotal * (discount || 0)) / 100);
    const factor = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 1;
    const taxes: Record<string, number> = {};
    for (const i of items) if (i.taxRate) taxes[i.taxRate] = (taxes[i.taxRate] || 0) + (i.qty || 0) * (i.rate || 0) * factor * (i.taxRate / 100);
    const taxTotal = r2(Object.values(taxes).reduce((a, b) => a + b, 0));
    return { subtotal, discountTotal, taxes, taxTotal, total: r2(subtotal - discountTotal + taxTotal + (adjustment || 0)) };
  }, [items, discount, adjustment]);

  const update = (idx: number, patch: Partial<EditorItem>) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="discountPercent" value={discount} />
      <input type="hidden" name="adjustment" value={adjustment} />

      {savedItems.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <select
            className="input max-w-sm"
            value=""
            onChange={(e) => {
              const s = savedItems.find((x) => x.id === Number(e.target.value));
              if (!s) return;
              const it = { description: s.description, longDescription: s.longDescription, qty: 1, rate: s.rate, unit: s.unit, taxRate: s.taxRate };
              setItems((list) => (list.length === 1 && !list[0].description ? [it] : [...list, it]));
            }}
          >
            <option value="">+ Add a saved item…</option>
            {savedItems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.description} — {fmt(s.rate)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="th w-[40%]">Item</th>
              <th className="th w-24">Qty</th>
              <th className="th w-32">Rate</th>
              <th className="th w-32">Tax</th>
              <th className="th w-32 text-right">Amount</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => (
              <tr key={idx} className="align-top">
                <td className="px-4 py-3">
                  <input className="input" placeholder="Description" value={it.description} onChange={(e) => update(idx, { description: e.target.value })} />
                  <textarea className="input mt-2 text-xs" rows={2} placeholder="Long description (optional)" value={it.longDescription ?? ""} onChange={(e) => update(idx, { longDescription: e.target.value })} />
                </td>
                <td className="px-4 py-3">
                  <input className="input" type="number" step="any" min="0" value={it.qty} onChange={(e) => update(idx, { qty: Number(e.target.value) })} />
                  <input className="input mt-2 text-xs" placeholder="Unit" value={it.unit ?? ""} onChange={(e) => update(idx, { unit: e.target.value })} />
                </td>
                <td className="px-4 py-3">
                  <input className="input" type="number" step="any" min="0" value={it.rate} onChange={(e) => update(idx, { rate: Number(e.target.value) })} />
                </td>
                <td className="px-4 py-3">
                  <select className="input" value={it.taxRate} onChange={(e) => update(idx, { taxRate: Number(e.target.value) })}>
                    <option value={0}>No tax</option>
                    {taxRates.map((t) => (
                      <option key={t.label} value={t.rate}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 pt-5 text-right text-sm font-medium">{fmt((it.qty || 0) * (it.rate || 0))}</td>
                <td className="px-2 py-3 pt-4">
                  <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-brand-red" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, i) => i !== idx) : [blank]))} aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-6 border-t border-slate-100 p-5 md:flex-row md:justify-between">
        <button type="button" onClick={() => setItems((l) => [...l, blank])} className="inline-flex h-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Plus className="h-4 w-4" /> Add line
        </button>
        <dl className="w-full max-w-sm space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium">{fmt(totals.subtotal)}</dd></div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Discount %</dt>
            <dd className="flex items-center gap-2">
              <input type="number" step="any" min="0" max="100" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input w-20 py-1" />
              <span className="w-24 text-right">-{fmt(totals.discountTotal)}</span>
            </dd>
          </div>
          {Object.entries(totals.taxes).map(([rate, amt]) => (
            <div key={rate} className="flex justify-between"><dt className="text-slate-500">Tax {rate}%</dt><dd>{fmt(r2(amt))}</dd></div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Adjustment</dt>
            <dd><input type="number" step="any" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="input w-32 py-1 text-right" /></dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold text-ink">{fmt(totals.total)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
