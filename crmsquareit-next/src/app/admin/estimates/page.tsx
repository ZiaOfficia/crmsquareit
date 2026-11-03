import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { docNumber } from "@/lib/sales";
import { ESTIMATE_STATUS } from "@/lib/constants";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Estimates" };

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("estimates");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const where: Prisma.EstimateWhereInput = {};
  if (sp.status === "EXPIRED") Object.assign(where, { status: { in: ["DRAFT", "SENT"] }, expiryDate: { lt: new Date() } });
  else if (sp.status) where.status = sp.status;
  if (sp.q) {
    const n = parseInt(sp.q.replace(/\D/g, ""), 10);
    where.OR = [{ customer: { company: { contains: sp.q } } }, ...(Number.isFinite(n) ? [{ number: n }] : [])];
  }
  const [rows, total] = await Promise.all([
    db.estimate.findMany({ where, skip, take, orderBy: [{ date: "desc" }, { number: "desc" }], include: { customer: { select: { company: true } } } }),
    db.estimate.count({ where }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Estimates" subtitle="Quotes you send before work starts" actions={<ButtonLink href="/admin/estimates/new">+ New estimate</ButtonLink>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Estimate # or customer…" />
          <FilterSelect name="status" placeholder="All statuses" options={Object.entries(ESTIMATE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No estimates found" action={<ButtonLink href="/admin/estimates/new">Create estimate</ButtonLink>} />
        ) : (
          <Table head={["Estimate", "Customer", "Date", "Expiry", "Amount", "Status", "Invoice"]}>
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <td className="td"><Link className="link" href={`/admin/estimates/${e.id}`}>{docNumber(e.prefix, e.number)}</Link></td>
                <td className="td">{e.customer.company}</td>
                <td className="td">{fmtDate(e.date)}</td>
                <td className="td">{fmtDate(e.expiryDate)}</td>
                <td className="td font-medium">{money(e.total, e.currency)}</td>
                <td className="td"><StatusBadge map={ESTIMATE_STATUS} value={["DRAFT", "SENT"].includes(e.status) && e.expiryDate && e.expiryDate < now ? "EXPIRED" : e.status} /></td>
                <td className="td">{e.invoiceId ? <Link className="link" href={`/admin/invoices/${e.invoiceId}`}>View</Link> : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
