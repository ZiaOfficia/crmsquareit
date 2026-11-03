import type { LineItem, Customer, Contact, Payment } from "@prisma/client";
import { money, fmtDate, round2 } from "@/lib/format";
import type { Settings } from "@/lib/settings";
import type { ReactNode } from "react";

type Doc = {
  title: string;
  number: string;
  date: Date;
  secondLabel: string;
  secondDate: Date | null;
  currency: string;
  subtotal: number;
  discountPercent: number;
  discountTotal: number;
  taxTotal: number;
  adjustment: number;
  total: number;
  clientNote: string | null;
  terms: string | null;
  items: LineItem[];
  customer: Customer & { contacts: Contact[] };
  payments?: Payment[];
  statusBadge?: ReactNode;
};

/** Printable invoice/estimate body used in admin and public pages. */
export function SalesDocument({ doc, settings }: { doc: Doc; settings: Settings }) {
  const c = doc.customer;
  const contact = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
  const factor = doc.subtotal > 0 ? (doc.subtotal - doc.discountTotal) / doc.subtotal : 1;
  const taxes: Record<string, number> = {};
  for (const i of doc.items) if (i.taxRate) taxes[i.taxRate] = (taxes[i.taxRate] || 0) + i.qty * i.rate * factor * (i.taxRate / 100);
  const paid = round2((doc.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const m = (n: number) => money(n, doc.currency);

  return (
    <div className="card overflow-hidden print:border-0 print:shadow-none">
      <div className="flex h-1.5">
        <span className="flex-1 bg-brand-green" /><span className="flex-1 bg-brand-red" /><span className="flex-1 bg-brand-blue" /><span className="flex-1 bg-brand-yellow" />
      </div>
      <div className="p-8 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-3 inline-block rounded-lg bg-sidebar px-3 py-2 print:bg-sidebar">
              <img src="/logo.png" alt={settings.company_name} className="h-10" />
            </div>
            <p className="font-semibold text-ink">{settings.company_name}</p>
            <p className="whitespace-pre-line text-sm text-slate-500">
              {[settings.company_address, [settings.company_city, settings.company_state, settings.company_zip].filter(Boolean).join(", "), settings.company_country].filter(Boolean).join("\n")}
            </p>
            {settings.company_vat && <p className="text-sm text-slate-500">GSTIN: {settings.company_vat}</p>}
            {settings.company_email && <p className="text-sm text-slate-500">{settings.company_email}</p>}
            {settings.company_phone && <p className="text-sm text-slate-500">{settings.company_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold uppercase tracking-tight text-ink">{doc.title}</p>
            <p className="mt-1 text-lg font-semibold text-slate-600"># {doc.number}</p>
            <div className="mt-2">{doc.statusBadge}</div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-between gap-6">
          <div>
            <p className="label">Bill to</p>
            <p className="font-semibold text-ink">{c.company}</p>
            {contact && <p className="text-sm text-slate-600">{contact.firstName} {contact.lastName}</p>}
            <p className="whitespace-pre-line text-sm text-slate-500">
              {[c.address, [c.city, c.state, c.zip].filter(Boolean).join(", "), c.country].filter(Boolean).join("\n")}
            </p>
            {c.vat && <p className="text-sm text-slate-500">GSTIN: {c.vat}</p>}
            {contact?.email && <p className="text-sm text-slate-500">{contact.email}</p>}
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-end gap-6"><dt className="text-slate-500">{doc.title} date</dt><dd className="w-32 text-right font-medium">{fmtDate(doc.date)}</dd></div>
            <div className="flex justify-end gap-6"><dt className="text-slate-500">{doc.secondLabel}</dt><dd className="w-32 text-right font-medium">{fmtDate(doc.secondDate)}</dd></div>
          </dl>
        </div>

        <table className="mt-8 min-w-full">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Item</th>
              <th className="px-3 py-2.5 text-right">Qty</th>
              <th className="px-3 py-2.5 text-right">Rate</th>
              <th className="px-3 py-2.5 text-right">Tax</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {doc.items.map((i, idx) => (
              <tr key={i.id} className="align-top">
                <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-800">{i.description}</p>
                  {i.longDescription && <p className="whitespace-pre-line text-xs text-slate-500">{i.longDescription}</p>}
                </td>
                <td className="px-3 py-3 text-right">{i.qty} {i.unit}</td>
                <td className="px-3 py-3 text-right">{m(i.rate)}</td>
                <td className="px-3 py-3 text-right">{i.taxRate ? `${i.taxRate}%` : "—"}</td>
                <td className="px-3 py-3 text-right font-medium">{m(i.qty * i.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{m(doc.subtotal)}</dd></div>
            {doc.discountTotal > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount ({doc.discountPercent}%)</dt><dd>-{m(doc.discountTotal)}</dd></div>}
            {Object.entries(taxes).map(([rate, amt]) => (
              <div key={rate} className="flex justify-between"><dt className="text-slate-500">Tax {rate}%</dt><dd>{m(round2(amt))}</dd></div>
            ))}
            {doc.adjustment !== 0 && <div className="flex justify-between"><dt className="text-slate-500">Adjustment</dt><dd>{m(doc.adjustment)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-ink"><dt>Total</dt><dd>{m(doc.total)}</dd></div>
            {doc.payments && paid > 0 && (
              <>
                <div className="flex justify-between text-brand-green"><dt>Paid</dt><dd>-{m(paid)}</dd></div>
                <div className="flex justify-between font-semibold text-brand-red"><dt>Amount due</dt><dd>{m(Math.max(0, round2(doc.total - paid)))}</dd></div>
              </>
            )}
          </dl>
        </div>

        {(doc.clientNote || doc.terms || settings.bank_details) && (
          <div className="mt-10 grid gap-6 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2">
            {doc.clientNote && <div><p className="label">Note</p><p className="whitespace-pre-line text-slate-600">{doc.clientNote}</p></div>}
            {settings.bank_details && doc.title === "Invoice" && <div><p className="label">Payment details</p><p className="whitespace-pre-line text-slate-600">{settings.bank_details}</p></div>}
            {doc.terms && <div className="sm:col-span-2"><p className="label">Terms & conditions</p><p className="whitespace-pre-line text-slate-600">{doc.terms}</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
