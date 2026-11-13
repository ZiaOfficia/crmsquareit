"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import type { ActionState } from "@/lib/forms";
import { INDIAN_STATES, inr, invoiceTotals, itemAmount, type TaxInvoiceItem } from "@/lib/tax-invoice";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card } from "@/components/ui";
import { customerBilling } from "./actions";
import { TAX_INVOICE_EXAMPLES } from "./examples";

export type TaxInvoiceFormValues = {
  number: string;
  issueDate: string;
  dueDate: string;
  customerId: string;
  billName: string;
  billAddress: string;
  billGstin: string;
  sameShip: boolean;
  shipName: string;
  shipAddress: string;
  placeOfSupply: string;
  items: TaxInvoiceItem[];
  terms: string;
  declaration: string;
};

type Saved = { id: number; description: string; longDescription: string | null; rate: number; unit: string | null; taxRate: number };

/** GST unit quantity codes most used on service invoices. */
const UNITS = ["OTH", "NOS", "HRS", "DAY", "MON", "YRS", "PCS", "SET", "UNT", "KGS"];
const blank = (taxRate: number): TaxInvoiceItem => ({ name: "", description: "", qty: 1, unit: "OTH", price: 0, discount: 0, taxRate });

export function TaxInvoiceForm({
  action,
  initial,
  customers,
  saved,
  taxRates,
  sellerState,
  dueDays,
  submitLabel,
  autoNumber,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial: TaxInvoiceFormValues;
  customers: { id: number; company: string }[];
  saved: Saved[];
  taxRates: number[];
  sellerState: string;
  dueDays: number;
  submitLabel: string;
  /** Number the invoice gets if the field is left as is / cleared. */
  autoNumber: string;
}) {
  const [v, setV] = useState(initial);
  const [items, setItems] = useState<TaxInvoiceItem[]>(initial.items.length ? initial.items : [blank(taxRates[0] ?? 18)]);
  const [pending, start] = useTransition();
  const set = <K extends keyof TaxInvoiceFormValues>(k: K, val: TaxInvoiceFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const on = (k: keyof TaxInvoiceFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const named = items.filter((i) => i.name.trim());
  const totals = invoiceTotals(named, v.placeOfSupply, sellerState);
  const intra = v.placeOfSupply && v.placeOfSupply.trim().toLowerCase() === sellerState.trim().toLowerCase();

  function pickCustomer(id: string) {
    set("customerId", id);
    if (!id) return;
    start(async () => {
      const d = await customerBilling(Number(id));
      if (!d) return;
      const state = INDIAN_STATES.find((s) => s.toLowerCase() === d.state.trim().toLowerCase());
      setV((p) => ({ ...p, customerId: id, billName: d.billName, billAddress: d.billAddress, billGstin: d.billGstin, placeOfSupply: state ?? p.placeOfSupply }));
    });
  }

  function setIssue(date: string) {
    setV((p) => {
      // Keep the due date the same number of days after the issue date.
      const due = date && dueDays ? new Date(new Date(date).getTime() + dueDays * 86_400_000).toISOString().slice(0, 10) : p.dueDate;
      return { ...p, issueDate: date, dueDate: due };
    });
  }

  const upd = (k: number, patch: Partial<TaxInvoiceItem>) => setItems((a) => a.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const move = (k: number, d: -1 | 1) =>
    setItems((a) => {
      const b = [...a];
      const t = k + d;
      if (t < 0 || t >= b.length) return a;
      [b[k], b[t]] = [b[t], b[k]];
      return b;
    });
  function addSaved(id: string) {
    const s = saved.find((x) => String(x.id) === id);
    if (!s) return;
    const it: TaxInvoiceItem = { name: s.description, description: s.longDescription ?? "", qty: 1, unit: s.unit || "OTH", price: s.rate, discount: 0, taxRate: s.taxRate };
    setItems((a) => (a.length === 1 && !a[0].name.trim() ? [it] : [...a, it]));
  }

  const [example, setExample] = useState<string | null>(null);
  function fillExample(key: string) {
    const e = TAX_INVOICE_EXAMPLES.find((x) => x.key === key);
    if (!e) return;
    setExample(e.hint);
    // Number, dates, terms and declaration stay as they are: those come from Settings.
    setV((p) => ({
      ...p,
      customerId: "",
      billName: e.billName,
      billAddress: e.billAddress,
      billGstin: e.billGstin,
      sameShip: !e.shipName && !e.shipAddress,
      shipName: e.shipName,
      shipAddress: e.shipAddress,
      placeOfSupply: e.placeOfSupply,
    }));
    setItems(e.items.map((i) => ({ ...i })));
  }
  function clearAll() {
    setExample(null);
    setV((p) => ({ ...p, customerId: "", billName: "", billAddress: "", billGstin: "", sameShip: true, shipName: "", shipAddress: "", placeOfSupply: sellerState }));
    setItems([blank(taxRates[0] ?? 18)]);
  }

  const numInput = (val: number, onChange: (n: number) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input type="number" step="any" min={0} value={Number.isFinite(val) ? val : 0} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="input text-right" {...props} />
  );

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(named)} />

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">Not sure what goes where?</span>
          <span className="text-sm text-slate-600">Fill an example, then change the details:</span>
          {TAX_INVOICE_EXAMPLES.map((e) => (
            <button key={e.key} type="button" onClick={() => fillExample(e.key)} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
              {e.label}
            </button>
          ))}
          <button type="button" onClick={clearAll} className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800">
            Clear
          </button>
        </div>
        {example && <p className="mt-2 text-xs text-slate-600">{example} Replace the sample client and items before saving.</p>}
        <ol className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
          <li><b className="text-slate-700">1 · Invoice:</b> leave the number empty for the next one; due date follows the issued date.</li>
          <li><b className="text-slate-700">2 · Bill to:</b> pick a customer or type name, address and GSTIN (15 characters).</li>
          <li><b className="text-slate-700">Place of supply:</b> client&apos;s state. {sellerState} → CGST + SGST, other states → IGST.</li>
          <li><b className="text-slate-700">3 · Items:</b> price is before GST; discount is %, GST % is per item. Totals update live.</li>
        </ol>
      </div>

      <Card title="1 · Invoice">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="label">Invoice no.</span>
            <input name="number" value={v.number} onChange={on("number")} placeholder={autoNumber} className="input font-mono" />
            <span className="mt-1 block text-xs text-slate-400">Leave empty for the next number ({autoNumber}).</span>
          </label>
          <label className="block">
            <span className="label">Issued date *</span>
            <input type="date" name="issueDate" required value={v.issueDate} onChange={(e) => setIssue(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="label">Due date</span>
            <input type="date" name="dueDate" value={v.dueDate} onChange={on("dueDate")} className="input" />
          </label>
        </div>
      </Card>

      <Card title="2 · Bill to / Ship to">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Customer</span>
            <select name="customerId" value={v.customerId} onChange={(e) => pickCustomer(e.target.value)} className="input">
              <option value="">— Not a saved customer (type the details below) —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-400">{pending ? "Filling in their billing details…" : "Picking one fills in the name, address, GSTIN and state. You can still edit them."}</span>
          </label>
          <label className="block">
            <span className="label">Bill to (name) *</span>
            <input name="billName" required maxLength={120} value={v.billName} onChange={on("billName")} placeholder="Shield Defence Academy" className="input" />
          </label>
          <label className="block">
            <span className="label">Client GSTIN</span>
            <input name="billGstin" maxLength={20} value={v.billGstin} onChange={on("billGstin")} placeholder="09ABCDE1234F1Z5" className="input font-mono uppercase" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Billing address</span>
            <textarea name="billAddress" rows={2} value={v.billAddress} onChange={on("billAddress")} placeholder="Beg Tower, Faizabad Road, Indiranagar, Lucknow-226016 UP" className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="sameShip" checked={v.sameShip} onChange={(e) => set("sameShip", e.target.checked)} />
            Ship to the same name and address
          </label>
          {!v.sameShip && (
            <>
              <label className="block">
                <span className="label">Ship to (name)</span>
                <input name="shipName" maxLength={120} value={v.shipName} onChange={on("shipName")} placeholder={v.billName} className="input" />
              </label>
              <label className="block sm:row-span-2">
                <span className="label">Shipping address</span>
                <textarea name="shipAddress" rows={3} value={v.shipAddress} onChange={on("shipAddress")} placeholder="Leave empty to use the billing address" className="input" />
              </label>
            </>
          )}
          <label className="block">
            <span className="label">Place of supply *</span>
            <select name="placeOfSupply" required value={v.placeOfSupply} onChange={on("placeOfSupply")} className="input">
              <option value="">— Pick a state —</option>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              {v.placeOfSupply && !INDIAN_STATES.includes(v.placeOfSupply) && <option>{v.placeOfSupply}</option>}
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              {!v.placeOfSupply ? `${sellerState} → CGST + SGST, any other state → IGST.` : intra ? "Same state as you → CGST + SGST." : "Other state → IGST."}
            </span>
          </label>
        </div>
      </Card>

      <Card
        title="3 · Items"
        actions={
          saved.length > 0 && (
            <select value="" onChange={(e) => addSaved(e.target.value)} className="input w-auto py-1 text-sm">
              <option value="">+ Add a saved item…</option>
              {saved.map((s) => <option key={s.id} value={s.id}>{s.description}</option>)}
            </select>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Item details</th>
                <th className="w-24 px-2 py-2 text-right">Qty</th>
                <th className="w-24 px-2 py-2">Unit</th>
                <th className="w-32 px-2 py-2 text-right">Price (₹)</th>
                <th className="w-20 px-2 py-2 text-right">Disc %</th>
                <th className="w-24 px-2 py-2 text-right">GST %</th>
                <th className="w-32 px-2 py-2 text-right">Amount</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {items.map((i, k) => (
                <tr key={k}>
                  <td className="space-y-1.5 px-3 py-2">
                    <input value={i.name} onChange={(e) => upd(k, { name: e.target.value })} maxLength={150} placeholder="Search engine marketing" className="input" />
                    <input value={i.description ?? ""} onChange={(e) => upd(k, { description: e.target.value })} maxLength={300} placeholder="Description (optional)" className="input text-xs" />
                  </td>
                  <td className="px-2 py-2">{numInput(i.qty, (n) => upd(k, { qty: n }))}</td>
                  <td className="px-2 py-2">
                    <input list="tinv-units" value={i.unit} onChange={(e) => upd(k, { unit: e.target.value.toUpperCase() })} maxLength={8} className="input uppercase" />
                  </td>
                  <td className="px-2 py-2">{numInput(i.price, (n) => upd(k, { price: n }))}</td>
                  <td className="px-2 py-2">{numInput(i.discount, (n) => upd(k, { discount: Math.min(100, n) }), { max: 100 })}</td>
                  <td className="px-2 py-2">
                    <select value={i.taxRate} onChange={(e) => upd(k, { taxRate: Number(e.target.value) })} className="input text-right">
                      {[...new Set([0, 5, 12, 18, 28, ...taxRates, i.taxRate])].sort((a, b) => a - b).map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 pt-4 text-right font-semibold tabular-nums">{inr(itemAmount(i))}</td>
                  <td className="whitespace-nowrap px-2 py-2 pt-3 text-right">
                    <button type="button" onClick={() => move(k, -1)} disabled={k === 0} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move up"><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(k, 1)} disabled={k === items.length - 1} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move down"><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setItems((a) => (a.length > 1 ? a.filter((_, x) => x !== k) : [blank(taxRates[0] ?? 18)]))} className="rounded p-1 text-slate-400 hover:text-red-600" title="Remove"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="tinv-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
          <button type="button" onClick={() => setItems((a) => [...a, blank(a.at(-1)?.taxRate ?? taxRates[0] ?? 18)])} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
            <Plus className="h-4 w-4" /> Add item
          </button>
          <dl className="w-full max-w-xs space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between font-semibold"><dt>Sub total</dt><dd>{inr(totals.subtotal)}</dd></div>
            {totals.taxes.map((t) => (
              <div key={t.label} className="flex justify-between text-slate-600"><dt>{t.label}</dt><dd>{inr(t.amount)}</dd></div>
            ))}
            {!v.placeOfSupply && totals.taxes.length > 0 && <p className="text-xs text-amber-600">Pick the place of supply to split the GST correctly.</p>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{inr(totals.total)}</dd></div>
          </dl>
        </div>
      </Card>

      <Card title="4 · Terms & declaration">
        <div className="grid gap-4 p-5">
          <label className="block">
            <span className="label">Terms & conditions</span>
            <textarea name="terms" rows={3} value={v.terms} onChange={on("terms")} placeholder="1. All invoices are due 7 days from the date of the invoice." className="input" />
            <span className="mt-1 block text-xs text-slate-400">One per line, printed as written.</span>
          </label>
          <label className="block">
            <span className="label">Declaration</span>
            <textarea name="declaration" rows={2} value={v.declaration} onChange={on("declaration")} className="input" />
          </label>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
