import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate, inputDate, money, round2 } from "@/lib/format";
import { docNumber, isOverdue } from "@/lib/sales";
import { INVOICE_STATUS } from "@/lib/constants";
import { ButtonLink, Card, Field, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ActionForm, ConfirmButton, CopyLink, PrintButton, SubmitButton } from "@/components/client";
import { SalesDocument } from "@/components/sales-document";
import { deleteInvoice, deletePayment, duplicateInvoice, recordPayment, setInvoiceStatus } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("invoices");
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id: Number(id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: { include: { contacts: true } }, payments: { orderBy: { date: "desc" } }, project: true, estimate: true },
  });
  if (!inv) notFound();
  const [settings, modes] = await Promise.all([getSettings(), db.paymentMode.findMany({ where: { active: true } })]);
  const number = docNumber(inv.prefix, inv.number);
  const paid = round2(inv.payments.reduce((s, p) => s + p.amount, 0));
  const due = Math.max(0, round2(inv.total - paid));
  const canEdit = can(user, "invoices", "edit");
  const status = isOverdue(inv) ? "OVERDUE" : inv.status;
  const statusForm = (s: string, label: string, variant: "primary" | "secondary" = "secondary") => (
    <form action={setInvoiceStatus}>
      <input type="hidden" name="id" value={inv.id} />
      <input type="hidden" name="status" value={s} />
      <button className={btn(variant)}>{label}</button>
    </form>
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={number}
          subtitle={
            <>
              <Link className="link" href={`/admin/customers/${inv.customerId}`}>{inv.customer.company}</Link>
              {inv.project && <> · project <Link className="link" href={`/admin/projects/${inv.project.id}`}>{inv.project.name}</Link></>}
              {inv.estimate && <> · from <Link className="link" href={`/admin/estimates/${inv.estimate.id}`}>{docNumber(inv.estimate.prefix, inv.estimate.number)}</Link></>}
            </>
          }
          back={{ href: "/admin/invoices", label: "Invoices" }}
          actions={
            <>
              <StatusBadge map={INVOICE_STATUS} value={status} />
              {canEdit && inv.status === "DRAFT" && statusForm("UNPAID", "Mark as sent", "primary")}
              {canEdit && inv.status !== "CANCELLED" && inv.status !== "PAID" && <ButtonLink variant="secondary" href={`/admin/invoices/${inv.id}/edit`}>Edit</ButtonLink>}
              <CopyLink path={`/invoice/${inv.hash}`} />
              <ButtonLink variant="secondary" href={`/invoice/${inv.hash}`}>Client view</ButtonLink>
              <PrintButton />
            </>
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesDocument settings={settings} doc={{ ...inv, title: "Invoice", number, secondLabel: "Due date", secondDate: inv.dueDate, statusBadge: <StatusBadge map={INVOICE_STATUS} value={status} /> }} />
        </div>
        <div className="no-print space-y-6">
          <Card title="Summary">
            <dl className="space-y-2 p-5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-semibold">{money(inv.total, inv.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="font-semibold text-brand-green">{money(paid, inv.currency)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="text-slate-500">Amount due</dt><dd className="text-lg font-bold text-brand-red">{money(due, inv.currency)}</dd></div>
            </dl>
          </Card>

          {can(user, "payments", "create") && inv.status !== "CANCELLED" && due > 0 && (
            <Card title="Record payment">
              <ActionForm action={recordPayment.bind(null, inv.id)} resetOnSuccess className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="Amount"><input name="amount" type="number" step="0.01" min="0.01" max={due} defaultValue={due} required className="input" /></Field>
                <Field label="Date"><input name="date" type="date" defaultValue={inputDate(new Date())} className="input" /></Field>
                <Field label="Payment mode">
                  <select name="mode" className="input">{modes.map((m) => <option key={m.id}>{m.name}</option>)}</select>
                </Field>
                <Field label="Transaction ID"><input name="transactionId" className="input" /></Field>
                <Field label="Note" className="sm:col-span-2"><input name="note" className="input" /></Field>
                <div className="sm:col-span-2"><SubmitButton variant="success" className="w-full">Record payment</SubmitButton></div>
              </ActionForm>
            </Card>
          )}

          <Card title={`Payments (${inv.payments.length})`}>
            {inv.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-semibold">{money(p.amount, inv.currency)}</p>
                      <p className="text-xs text-slate-500">{p.mode} · {fmtDate(p.date)}{p.transactionId && ` · ${p.transactionId}`}</p>
                    </div>
                    {can(user, "payments", "delete") && <ConfirmButton action={deletePayment} hidden={{ id: p.id }} label="✕" confirmLabel="Delete?" variant="ghost" className="px-2 py-1 text-xs" />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="More actions">
            <div className="flex flex-wrap gap-2 p-4">
              {can(user, "invoices", "create") && (
                <form action={duplicateInvoice}><input type="hidden" name="id" value={inv.id} /><button className={btn("secondary")}>Duplicate</button></form>
              )}
              {canEdit && inv.status !== "CANCELLED" && statusForm("CANCELLED", "Cancel invoice")}
              {canEdit && inv.status === "CANCELLED" && statusForm("UNPAID", "Re-open invoice")}
              {canEdit && inv.status !== "DRAFT" && paid === 0 && inv.status !== "CANCELLED" && statusForm("DRAFT", "Back to draft")}
              {can(user, "invoices", "delete") && <ConfirmButton action={deleteInvoice} hidden={{ id: inv.id }} label="Delete invoice" />}
            </div>
            {inv.sentAt && <p className="px-5 pb-4 text-xs text-slate-500">Sent on {fmtDate(inv.sentAt)}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
