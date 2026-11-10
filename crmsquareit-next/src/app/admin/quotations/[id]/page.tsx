import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Copy, Download, ExternalLink, Pencil } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate, money, timeAgo } from "@/lib/format";
import { docNumber } from "@/lib/sales";
import { QUOTATION_STATUS } from "@/lib/constants";
import { canSeeQuotation, displayStatus, quotationInclude } from "@/lib/quotations";
import { ButtonLink, Card, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { deleteQuotation, duplicateQuotation, setQuotationStatus } from "../actions";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("quotations");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await db.quotation.findUnique({ where: { id }, include: quotationInclude });
  if (!q) notFound();
  if (!canSeeQuotation(user, q)) redirect("/admin/forbidden");
  const [settings, activity] = await Promise.all([
    getSettings(),
    db.activity.findMany({ where: { relType: "quotation", relId: id }, orderBy: { createdAt: "desc" }, take: 15, include: { staff: { select: { firstName: true, lastName: true } } } }),
  ]);

  const number = docNumber(q.prefix, q.number);
  const status = displayStatus(q);
  const canEdit = can(user, "quotations", "edit");

  const statusBtn = (s: string, label: string, v: "primary" | "secondary" | "success" = "secondary") => (
    <form action={setQuotationStatus}>
      <input type="hidden" name="id" value={q.id} />
      <input type="hidden" name="status" value={s} />
      <button className={btn(v)}>{label}</button>
    </form>
  );

  return (
    <>
      <PageHeader
        title={number}
        subtitle={q.subject}
        back={{ href: "/admin/quotations", label: "Quotations" }}
        actions={
          <>
            <StatusBadge map={QUOTATION_STATUS} value={status} />
            <a href={`/admin/quotations/${q.id}/pdf`} className={btn("primary")}>
              <Download className="h-4 w-4" /> Download PDF
            </a>
            <a href={`/admin/quotations/${q.id}/pdf?inline=1`} target="_blank" rel="noreferrer" className={btn("secondary")}>
              <ExternalLink className="h-4 w-4" /> Preview PDF
            </a>
            {canEdit && q.status === "DRAFT" && statusBtn("SENT", "Mark as sent")}
            {canEdit && q.status === "SENT" && statusBtn("ACCEPTED", "Mark accepted", "success")}
            {canEdit && q.status === "SENT" && statusBtn("DECLINED", "Mark declined")}
            {canEdit && (q.status === "DECLINED" || q.status === "SENT") && statusBtn("DRAFT", "Back to draft")}
            {canEdit && q.status !== "ACCEPTED" && (
              <ButtonLink variant="secondary" href={`/admin/quotations/${q.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </ButtonLink>
            )}
            {can(user, "quotations", "create") && (
              <form action={duplicateQuotation}>
                <input type="hidden" name="id" value={q.id} />
                <button className={btn("secondary")} title="Copy as a new draft">
                  <Copy className="h-4 w-4" /> Duplicate
                </button>
              </form>
            )}
            {can(user, "quotations", "delete") && <ConfirmButton action={deleteQuotation} hidden={{ id: q.id }} confirmLabel="Delete quotation?" />}
          </>
        }
      />

      {q.status === "ACCEPTED" && q.lead && !q.lead.customerId && can(user, "customers", "create") && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Accepted by a lead. Turn <strong>{q.lead.name}</strong> into a customer from the lead page so HR can invoice them.
          <Link href={`/admin/leads/${q.lead.id}`} className="ml-auto font-semibold underline">Open lead</Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* The real PDF, so what BDE sees here is exactly what the client gets. */}
        <div className="card overflow-hidden xl:col-span-2">
          <iframe src={`/admin/quotations/${q.id}/pdf?inline=1#view=FitH`} title={`Quotation ${number}`} className="h-[80vh] min-h-[600px] w-full bg-slate-100" />
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <dl className="divide-y divide-slate-100 px-5 text-sm">
              <div className="flex justify-between py-2"><dt className="text-slate-500">Client</dt><dd className="text-right font-medium">{q.clientCompany || q.clientName}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Date</dt><dd className="font-medium">{fmtDate(q.date)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Valid until</dt><dd className="font-medium">{fmtDate(q.validUntil)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Services</dt><dd className="font-medium">{q.items.length}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Total</dt><dd className="font-bold text-ink">{money(q.total, q.currency)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Prepared by</dt><dd className="font-medium">{q.createdBy ? `${q.createdBy.firstName} ${q.createdBy.lastName}` : "—"}</dd></div>
            </dl>
          </Card>
          <Card title="Linked to">
            <div className="space-y-2 p-5 text-sm">
              {q.lead ? (
                <p>Lead: <Link href={`/admin/leads/${q.lead.id}`} className="link">{q.lead.name}{q.lead.company ? ` · ${q.lead.company}` : ""}</Link></p>
              ) : null}
              {q.customer ? (
                <p>Customer: <Link href={`/admin/customers/${q.customer.id}`} className="link">{q.customer.company}</Link></p>
              ) : null}
              {!q.lead && !q.customer && <p className="text-slate-500">Not linked to a lead or customer.</p>}
            </div>
          </Card>
          <Card title="History">
            {activity.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-800">{a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "System"}</span>{" "}
                    <span className="text-slate-600">{a.description}</span>
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
