import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { docNumber } from "@/lib/sales";
import { ESTIMATE_STATUS } from "@/lib/constants";
import { ButtonLink, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ConfirmButton, CopyLink, PrintButton } from "@/components/client";
import { SalesDocument } from "@/components/sales-document";
import { convertToInvoice, deleteEstimate, setEstimateStatus } from "../actions";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("estimates");
  const { id } = await params;
  const est = await db.estimate.findUnique({
    where: { id: Number(id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: { include: { contacts: true } }, invoice: true },
  });
  if (!est) notFound();
  const settings = await getSettings();
  const number = docNumber(est.prefix, est.number);
  const canEdit = can(user, "estimates", "edit");
  const statusBtn = (s: string, label: string, v: "primary" | "secondary" | "success" = "secondary") => (
    <form action={setEstimateStatus}>
      <input type="hidden" name="id" value={est.id} />
      <input type="hidden" name="status" value={s} />
      <button className={btn(v)}>{label}</button>
    </form>
  );
  return (
    <>
      <div className="no-print">
        <PageHeader
          title={number}
          subtitle={<Link className="link" href={`/admin/customers/${est.customerId}`}>{est.customer.company}</Link>}
          back={{ href: "/admin/estimates", label: "Estimates" }}
          actions={
            <>
              <StatusBadge map={ESTIMATE_STATUS} value={est.status} />
              {canEdit && est.status === "DRAFT" && statusBtn("SENT", "Mark as sent", "primary")}
              {canEdit && est.status === "SENT" && statusBtn("ACCEPTED", "Mark accepted", "success")}
              {canEdit && est.status === "SENT" && statusBtn("DECLINED", "Mark declined")}
              {est.invoice ? (
                <ButtonLink variant="success" href={`/admin/invoices/${est.invoice.id}`}>View invoice {docNumber(est.invoice.prefix, est.invoice.number)}</ButtonLink>
              ) : (
                can(user, "invoices", "create") && est.status !== "DECLINED" && (
                  <form action={convertToInvoice}>
                    <input type="hidden" name="id" value={est.id} />
                    <button className={btn("success")}>Convert to invoice</button>
                  </form>
                )
              )}
              {canEdit && !est.invoice && <ButtonLink variant="secondary" href={`/admin/estimates/${est.id}/edit`}>Edit</ButtonLink>}
              <CopyLink path={`/estimate/${est.hash}`} />
              <PrintButton />
              {can(user, "estimates", "delete") && <ConfirmButton action={deleteEstimate} hidden={{ id: est.id }} />}
            </>
          }
        />
      </div>
      <div className="max-w-4xl">
        <SalesDocument settings={settings} doc={{ ...est, title: "Estimate", number, secondLabel: "Valid until", secondDate: est.expiryDate, statusBadge: <StatusBadge map={ESTIMATE_STATUS} value={est.status} /> }} />
      </div>
    </>
  );
}
