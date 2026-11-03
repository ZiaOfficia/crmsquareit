import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, Table, btn, cx } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";
import { Kanban } from "@/components/kanban";
import { moveLead } from "./actions";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("leads");
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const { currency } = await getSettings();
  const where: Prisma.LeadWhereInput = { junk: sp.junk === "1" };
  if (sp.lost !== "1" && sp.junk !== "1") where.lost = false;
  if (sp.lost === "1") where.lost = true;
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { company: { contains: sp.q } }, { email: { contains: sp.q } }, { phone: { contains: sp.q } }];
  if (sp.status) where.statusId = Number(sp.status);
  if (sp.source) where.sourceId = Number(sp.source);
  if (sp.assigned) where.assignedId = Number(sp.assigned);

  const [statuses, sources, staff] = await Promise.all([
    db.leadStatus.findMany({ orderBy: { order: "asc" } }),
    db.leadSource.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const qs = (v: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, x]) => x && k !== "view" && k !== "page") as [string, string][]);
    p.set("view", v);
    return `?${p}`;
  };

  const header = (
    <PageHeader
      title="Leads"
      subtitle="Track and convert your prospects"
      actions={
        <>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            <Link href={qs("list")} className={cx("rounded-md px-3 py-1.5 text-sm", view === "list" ? "bg-slate-100 font-medium" : "text-slate-500")}>List</Link>
            <Link href={qs("kanban")} className={cx("rounded-md px-3 py-1.5 text-sm", view === "kanban" ? "bg-slate-100 font-medium" : "text-slate-500")}>Kanban</Link>
          </div>
          <ButtonLink href="/admin/leads/new">+ New lead</ButtonLink>
        </>
      }
    />
  );
  const filters = (
    <div className="flex flex-wrap gap-2">
      <SearchBox placeholder="Search leads…" />
      {view === "list" && <FilterSelect name="status" placeholder="All statuses" options={statuses.map((s) => ({ value: String(s.id), label: s.name }))} />}
      <FilterSelect name="source" placeholder="All sources" options={sources.map((s) => ({ value: String(s.id), label: s.name }))} />
      <FilterSelect name="assigned" placeholder="Anyone" options={staff.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName}` }))} />
      <Link href={sp.lost === "1" ? "?" : "?lost=1"} className={btn(sp.lost === "1" ? "primary" : "secondary")}>Lost</Link>
      <Link href={sp.junk === "1" ? "?" : "?junk=1"} className={btn(sp.junk === "1" ? "primary" : "secondary")}>Junk</Link>
    </div>
  );

  if (view === "kanban") {
    const leads = await db.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { assigned: true, source: true } });
    return (
      <>
        {header}
        <div className="mb-4">{filters}</div>
        <Kanban
          columns={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          cards={leads.map((l) => ({
            id: l.id,
            columnId: l.statusId,
            title: l.name,
            subtitle: [l.company, l.source?.name].filter(Boolean).join(" · "),
            meta: [l.value ? money(l.value, currency) : null, l.assigned ? `→ ${l.assigned.firstName}` : null].filter(Boolean).join("  "),
            href: `/admin/leads/${l.id}`,
          }))}
          onMove={moveLead}
        />
      </>
    );
  }

  const { page, skip, take } = pageArgs(sp.page);
  const [rows, total] = await Promise.all([
    db.lead.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { status: true, source: true, assigned: true } }),
    db.lead.count({ where }),
  ]);
  return (
    <>
      {header}
      <Card>
        <div className="border-b border-slate-100 p-4">{filters}</div>
        {rows.length === 0 ? (
          <EmptyState title="No leads found" action={<ButtonLink href="/admin/leads/new">Add lead</ButtonLink>} />
        ) : (
          <Table head={["Name", "Company", "Contact", "Value", "Source", "Assigned", "Status", "Created"]}>
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/60">
                <td className="td"><Link href={`/admin/leads/${l.id}`} className="link">{l.name}</Link></td>
                <td className="td">{l.company ?? "—"}</td>
                <td className="td text-xs">
                  <div>{l.email}</div>
                  <div className="text-slate-500">{l.phone}</div>
                </td>
                <td className="td">{l.value ? money(l.value, currency) : "—"}</td>
                <td className="td">{l.source?.name ?? "—"}</td>
                <td className="td">{l.assigned ? <Avatar name={`${l.assigned.firstName} ${l.assigned.lastName}`} size={26} /> : "—"}</td>
                <td className="td">
                  <Badge color={l.status.color}>{l.status.name}</Badge>
                  {l.lost && <Badge tone="red">Lost</Badge>}
                </td>
                <td className="td text-slate-500">{fmtDate(l.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
