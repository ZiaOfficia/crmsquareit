import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { dmy, inr } from "@/lib/tax-invoice";
import { TAX_INVOICE_STATUS, taxInvoiceDisplayStatus } from "@/lib/tax-invoice-server";
import { ButtonLink, Card, EmptyState, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Tax invoices" };

export default async function TaxInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("invoices");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const today = new Date(new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10));
  const where: Prisma.TaxInvoiceWhereInput = {};
  if (sp.status === "OVERDUE") Object.assign(where, { status: "UNPAID", dueDate: { lt: today } });
  else if (sp.status) where.status = sp.status;
  if (sp.fy) where.fy = sp.fy;
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { billName: { contains: q, mode: "insensitive" } },
      { billGstin: { contains: q, mode: "insensitive" } },
    ];
  }
  const [rows, total, sums, years] = await Promise.all([
    db.taxInvoice.findMany({ where, skip, take, orderBy: [{ issueDate: "desc" }, { seq: "desc" }] }),
    db.taxInvoice.count({ where }),
    db.taxInvoice.groupBy({ by: ["status"], where: { status: { not: "CANCELLED" }, ...(sp.fy ? { fy: sp.fy } : {}) }, _sum: { total: true, taxTotal: true } }),
    db.taxInvoice.findMany({ distinct: ["fy"], select: { fy: true }, orderBy: { fy: "desc" } }),
  ]);
  const sum = (st: string) => sums.find((x) => x.status === st)?._sum.total ?? 0;
  const gst = sums.reduce((a, x) => a + (x._sum.taxTotal ?? 0), 0);
  const createBtn = can(user, "invoices", "create") && <ButtonLink href="/admin/tax-invoices/new">+ New tax invoice</ButtonLink>;

  return (
    <>
      <PageHeader title="Tax invoices" subtitle="GST invoices (CGST + SGST / IGST) in the Squareit PDF template" actions={createBtn} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Unpaid" value={inr(sum("UNPAID"))} accent="yellow" href="/admin/tax-invoices?status=UNPAID" />
        <Stat label="Paid" value={inr(sum("PAID"))} accent="green" href="/admin/tax-invoices?status=PAID" />
        <Stat label={sp.fy ? `GST billed in FY ${sp.fy}` : "GST billed (all time)"} value={inr(gst)} accent="blue" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Invoice no., client or GSTIN…" />
          <FilterSelect name="status" placeholder="All statuses" options={Object.entries(TAX_INVOICE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          {years.length > 0 && <FilterSelect name="fy" placeholder="All financial years" options={years.map((y) => ({ value: y.fy, label: `FY 20${y.fy}` }))} />}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No tax invoices found" text="Create one and download it as a PDF in the Squareit GST template." action={createBtn || undefined} />
        ) : (
          <Table head={["Invoice no.", "Bill to", "Issued", "Due", "GST", "Total", "Status", ""]}>
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50/60">
                <td className="td font-mono"><Link className="link" href={`/admin/tax-invoices/${i.id}`}>{i.number}</Link></td>
                <td className="td">
                  {i.billName}
                  {i.billGstin && <span className="block font-mono text-xs text-slate-400">{i.billGstin}</span>}
                </td>
                <td className="td">{dmy(i.issueDate)}</td>
                <td className="td">{i.dueDate ? dmy(i.dueDate) : "—"}</td>
                <td className="td tabular-nums">{inr(i.taxTotal)}</td>
                <td className="td font-medium tabular-nums">{inr(i.total)}</td>
                <td className="td"><StatusBadge map={TAX_INVOICE_STATUS} value={taxInvoiceDisplayStatus(i)} /></td>
                <td className="td text-right">
                  <a href={`/admin/tax-invoices/${i.id}/pdf`} className="inline-flex text-slate-400 hover:text-blue-600" title="Download PDF">
                    <Download className="h-4 w-4" />
                  </a>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
