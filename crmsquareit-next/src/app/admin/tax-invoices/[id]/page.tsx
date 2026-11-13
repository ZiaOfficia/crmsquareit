import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, ExternalLink, Pencil } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { timeAgo } from "@/lib/format";
import { dmy, inr, invoiceTotals, parseTaxItems } from "@/lib/tax-invoice";
import { TAX_INVOICE_STATUS, taxInvoiceDisplayStatus } from "@/lib/tax-invoice-server";
import { ButtonLink, Card, DetailRow, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { deleteTaxInvoice, duplicateTaxInvoice, setTaxInvoiceStatus } from "../actions";

export default async function TaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("invoices");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const inv = await db.taxInvoice.findUnique({ where: { id } });
  if (!inv) notFound();
  const [s, customer, activity] = await Promise.all([
    getSettings(),
    inv.customerId ? db.customer.findUnique({ where: { id: inv.customerId }, select: { id: true, company: true } }) : null,
    db.activity.findMany({ where: { relType: "tax_invoice", relId: id }, orderBy: { createdAt: "desc" }, take: 15, include: { staff: { select: { firstName: true, lastName: true } } } }),
  ]);
  const totals = invoiceTotals(parseTaxItems(inv.items), inv.placeOfSupply, s.tinv_seller_state);
  const canEdit = can(user, "invoices", "edit");

  const statusBtn = (status: string, label: string, v: "secondary" | "success" = "secondary") => (
    <form action={setTaxInvoiceStatus}>
      <input type="hidden" name="id" value={inv.id} />
      <input type="hidden" name="status" value={status} />
      <button className={btn(v)}>{label}</button>
    </form>
  );

  return (
    <>
      <PageHeader
        title={inv.number}
        subtitle={inv.billName}
        back={{ href: "/admin/tax-invoices", label: "Tax invoices" }}
        actions={
          <>
            <StatusBadge map={TAX_INVOICE_STATUS} value={taxInvoiceDisplayStatus(inv)} />
            <a href={`/admin/tax-invoices/${inv.id}/pdf`} className={btn("primary")}>
              <Download className="h-4 w-4" /> Download PDF
            </a>
            <a href={`/admin/tax-invoices/${inv.id}/pdf?inline=1`} target="_blank" rel="noreferrer" className={btn("secondary")}>
              <ExternalLink className="h-4 w-4" /> Open PDF
            </a>
            {canEdit && inv.status === "UNPAID" && statusBtn("PAID", "Mark as paid", "success")}
            {canEdit && inv.status !== "UNPAID" && statusBtn("UNPAID", "Mark as unpaid")}
            {canEdit && inv.status === "UNPAID" && statusBtn("CANCELLED", "Cancel invoice")}
            {canEdit && (
              <ButtonLink variant="secondary" href={`/admin/tax-invoices/${inv.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </ButtonLink>
            )}
            {can(user, "invoices", "create") && (
              <form action={duplicateTaxInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <button className={btn("secondary")} title="Copy as a new invoice with the next number">
                  <Copy className="h-4 w-4" /> Duplicate
                </button>
              </form>
            )}
            {can(user, "invoices", "delete") && <ConfirmButton action={deleteTaxInvoice} hidden={{ id: inv.id }} confirmLabel="Delete invoice?" />}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          {/* The real PDF, so what you see is exactly what the client gets. */}
          <iframe title={`Invoice ${inv.number}`} src={`/admin/tax-invoices/${inv.id}/pdf?inline=1#toolbar=0&view=FitH`} className="h-[80vh] min-h-[600px] w-full bg-slate-100" />
        </Card>
        <div className="space-y-6">
          <Card title="Summary">
            <div className="divide-y divide-slate-100">
              <DetailRow label="Issued">{dmy(inv.issueDate)}</DetailRow>
              <DetailRow label="Due">{inv.dueDate ? dmy(inv.dueDate) : "—"}</DetailRow>
              <DetailRow label="Customer">{customer ? <Link className="link" href={`/admin/customers/${customer.id}`}>{customer.company}</Link> : "—"}</DetailRow>
              <DetailRow label="GSTIN">{inv.billGstin || "—"}</DetailRow>
              <DetailRow label="Place of supply">{inv.placeOfSupply}</DetailRow>
              <DetailRow label="Sub total">{inr(totals.subtotal)}</DetailRow>
              {totals.taxes.map((t) => <DetailRow key={t.label} label={t.label}>{inr(t.amount)}</DetailRow>)}
              <DetailRow label="Total"><span className="font-semibold">{inr(totals.total)}</span></DetailRow>
            </div>
          </Card>
          <Card title="Activity">
            {activity.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <span className="font-medium">{a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "System"}</span> {a.description}
                    <span className="block text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
