import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { docNumber } from "@/lib/sales";
import { QUOTATION_STATUS } from "@/lib/constants";
import { displayStatus, quotationScope } from "@/lib/quotations";
import { ButtonLink, Card, EmptyState, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("quotations");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const { currency } = await getSettings();
  const scope = quotationScope(user);
  const today = new Date(new Date().toDateString());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const where: Prisma.QuotationWhereInput = { ...scope };
  if (sp.status === "EXPIRED") Object.assign(where, { status: { in: ["DRAFT", "SENT"] }, validUntil: { lt: today } });
  else if (sp.status) where.status = sp.status;
  if (sp.q) {
    const n = parseInt(sp.q.replace(/\D/g, ""), 10);
    where.OR = [
      { subject: { contains: sp.q, mode: "insensitive" } },
      { clientName: { contains: sp.q, mode: "insensitive" } },
      { clientCompany: { contains: sp.q, mode: "insensitive" } },
      ...(Number.isFinite(n) ? [{ number: n }] : []),
    ];
  }

  const [rows, total, month, open, won, decided] = await Promise.all([
    db.quotation.findMany({ where, skip, take, orderBy: [{ date: "desc" }, { number: "desc" }], include: { createdBy: { select: { firstName: true } } } }),
    db.quotation.count({ where }),
    db.quotation.aggregate({ where: { ...scope, date: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    db.quotation.aggregate({ where: { ...scope, status: "SENT", OR: [{ validUntil: null }, { validUntil: { gte: today } }] }, _sum: { total: true }, _count: true }),
    db.quotation.aggregate({ where: { ...scope, status: "ACCEPTED", date: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    db.quotation.groupBy({ by: ["status"], where: { ...scope, status: { in: ["ACCEPTED", "DECLINED"] } }, _count: true }),
  ]);
  const acc = decided.find((d) => d.status === "ACCEPTED")?._count ?? 0;
  const dec = decided.find((d) => d.status === "DECLINED")?._count ?? 0;
  const winRate = acc + dec ? Math.round((acc / (acc + dec)) * 100) : null;
  const mineOnly = Object.keys(scope).length > 0;
  const canCreate = can(user, "quotations", "create");

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle={mineOnly ? "Quotations you've made for leads and customers." : "Priced proposals sent to leads and customers."}
        actions={canCreate && <ButtonLink href="/admin/quotations/new">+ New quotation</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="This month" value={money(month._sum.total ?? 0, currency)} sub={`${month._count} quotation${month._count === 1 ? "" : "s"}`} accent="blue" />
        <Stat label="Waiting for reply" value={money(open._sum.total ?? 0, currency)} sub={`${open._count} sent, still valid`} accent="yellow" href="/admin/quotations?status=SENT" />
        <Stat label="Won this month" value={money(won._sum.total ?? 0, currency)} sub={`${won._count} accepted`} accent="green" href="/admin/quotations?status=ACCEPTED" />
        <Stat label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub={`${acc} accepted · ${dec} declined`} accent="red" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Quotation #, subject or client…" />
          <FilterSelect name="status" placeholder="All statuses" options={Object.entries(QUOTATION_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={sp.q || sp.status ? "No quotations match" : "No quotations yet"}
            text={sp.q || sp.status ? undefined : "Make one for a lead or customer, then download it as a PDF."}
            action={canCreate && !sp.q && !sp.status ? <ButtonLink href="/admin/quotations/new">Create quotation</ButtonLink> : undefined}
          />
        ) : (
          <Table head={["Quotation", "Client", "Date", "Valid until", "Amount", "Status", ...(mineOnly ? [] : ["By"]), ""]}>
            {rows.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50/60">
                <td className="td">
                  <Link className="link" href={`/admin/quotations/${q.id}`}>{docNumber(q.prefix, q.number)}</Link>
                  <span className="block max-w-xs truncate text-xs text-slate-500">{q.subject}</span>
                </td>
                <td className="td">
                  {q.clientCompany || q.clientName}
                  {q.clientCompany && <span className="block text-xs text-slate-400">{q.clientName}</span>}
                </td>
                <td className="td whitespace-nowrap">{fmtDate(q.date)}</td>
                <td className="td whitespace-nowrap">{fmtDate(q.validUntil)}</td>
                <td className="td whitespace-nowrap font-medium">{money(q.total, q.currency)}</td>
                <td className="td"><StatusBadge map={QUOTATION_STATUS} value={displayStatus(q)} /></td>
                {!mineOnly && <td className="td text-slate-500">{q.createdBy?.firstName ?? "—"}</td>}
                <td className="td text-right">
                  <a href={`/admin/quotations/${q.id}/pdf`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary" title="Download PDF">
                    <Download className="h-3.5 w-3.5" /> PDF
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
