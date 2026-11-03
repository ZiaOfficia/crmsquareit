import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge, Table } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";

export const metadata = { title: "Support" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("tickets");
  const sp = await searchParams;
  const { page, skip, take } = pageArgs(sp.page);
  const where: Prisma.TicketWhereInput = {};
  if (sp.status) where.status = sp.status;
  else if (sp.all !== "1") where.status = { not: "CLOSED" };
  if (sp.department) where.departmentId = Number(sp.department);
  if (sp.q) where.OR = [{ subject: { contains: sp.q } }, { customer: { company: { contains: sp.q } } }];
  const [rows, total, groups, depts] = await Promise.all([
    db.ticket.findMany({ where, skip, take, orderBy: [{ lastReply: "desc" }, { createdAt: "desc" }], include: { customer: true, contact: true, department: true, assigned: true, _count: { select: { replies: true } } } }),
    db.ticket.count({ where }),
    db.ticket.groupBy({ by: ["status"], _count: true }),
    db.department.findMany(),
  ]);
  return (
    <>
      <PageHeader title="Support tickets" actions={<ButtonLink href="/admin/tickets/new">+ Open ticket</ButtonLink>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(TICKET_STATUS).map(([k, v]) => (
          <Link key={k} href={`?status=${k}`} className="card px-4 py-3 hover:shadow-md">
            <p className="text-2xl font-bold text-ink">{groups.find((g) => g.status === k)?._count ?? 0}</p>
            <p className="text-xs text-slate-500">{v.label}</p>
          </Link>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <SearchBox placeholder="Subject or customer…" />
          <FilterSelect name="status" placeholder="All open" options={Object.entries(TICKET_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          <FilterSelect name="department" placeholder="All departments" options={depts.map((d) => ({ value: String(d.id), label: d.name }))} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No tickets" text="Great — the support queue is empty." />
        ) : (
          <Table head={["#", "Subject", "Customer", "Department", "Assigned", "Priority", "Status", "Last reply"]}>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/60">
                <td className="td text-slate-400">#{t.id}</td>
                <td className="td"><Link className="link" href={`/admin/tickets/${t.id}`}>{t.subject}</Link> <span className="text-xs text-slate-400">({t._count.replies})</span></td>
                <td className="td">{t.customer?.company ?? t.name ?? "—"}</td>
                <td className="td">{t.department?.name ?? "—"}</td>
                <td className="td">{t.assigned ? `${t.assigned.firstName} ${t.assigned.lastName}` : "—"}</td>
                <td className="td"><StatusBadge map={PRIORITY} value={t.priority} /></td>
                <td className="td"><StatusBadge map={TICKET_STATUS} value={t.status} /></td>
                <td className="td text-xs text-slate-500">{timeAgo(t.lastReply ?? t.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
