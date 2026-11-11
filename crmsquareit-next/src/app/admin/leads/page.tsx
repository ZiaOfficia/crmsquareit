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
import { docNumber } from "@/lib/sales";
import { LEAD_STAGES, STAGE_INFO, stageInclude, stageOf, stageWhere, type LeadStage } from "@/lib/lead-flow";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("leads");
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const { currency } = await getSettings();
  const stage = (LEAD_STAGES as readonly string[]).includes(sp.stage ?? "") ? (sp.stage as LeadStage) : null;
  // Filters shared by every stage chip (search, source, assignee); the stage / lost part is added below.
  const where: Prisma.LeadWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { company: { contains: sp.q } }, { email: { contains: sp.q } }, { phone: { contains: sp.q } }];
  if (sp.status) where.statusId = Number(sp.status);
  if (sp.source) where.sourceId = Number(sp.source);
  if (sp.assigned) where.assignedId = Number(sp.assigned);
  const filtered: Prisma.LeadWhereInput = stage
    ? { AND: [where, stageWhere(stage)] }
    : sp.lost === "1"
      ? { ...where, lost: true }
      : { ...where, lost: false, junk: false };

  const [stageCounts, statuses, sources, staff] = await Promise.all([
    Promise.all(LEAD_STAGES.map((s) => db.lead.count({ where: { AND: [where, stageWhere(s)] } }))),
    db.leadStatus.findMany({ orderBy: { order: "asc" } }),
    db.leadSource.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const chip = (key: string | null) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, x]) => x && !["stage", "page", "lost", "junk"].includes(k)) as [string, string][]);
    if (key === "LOST") p.set("lost", "1");
    else if (key) p.set("stage", key);
    const q = p.toString();
    return q ? `?${q}` : "?";
  };
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
    </div>
  );
  const stageChips = (
    <div className="flex flex-wrap gap-1.5">
      <Link
        href={chip(null)}
        className={cx("rounded-full border px-3 py-1 text-xs font-medium", !stage && sp.lost !== "1" ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
      >
        All open
      </Link>
      {LEAD_STAGES.map((s, i) => {
        const on = stage === s;
        return (
          <Link
            key={s}
            href={chip(s)}
            className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", on ? "text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
            style={on ? { backgroundColor: STAGE_INFO[s].color, borderColor: STAGE_INFO[s].color } : undefined}
          >
            {!on && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_INFO[s].color }} />}
            {STAGE_INFO[s].label}
            <span className={cx("rounded-full px-1.5 text-[10px]", on ? "bg-white/25" : "bg-slate-100")}>{stageCounts[i]}</span>
          </Link>
        );
      })}
      <Link
        href={chip("LOST")}
        className={cx("rounded-full border px-3 py-1 text-xs font-medium", sp.lost === "1" ? "border-brand-red bg-brand-red text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
      >
        Lost
      </Link>
    </div>
  );

  if (view === "kanban") {
    const leads = await db.lead.findMany({ where: filtered, orderBy: { createdAt: "desc" }, include: { assigned: true, source: true } });
    return (
      <>
        {header}
        <div className="mb-4 space-y-3">
          {filters}
          {stageChips}
        </div>
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
  const today = new Date(new Date().toDateString());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [rows, total] = await Promise.all([
    db.lead.findMany({
      where: filtered,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        ...stageInclude,
        status: true,
        source: true,
        assigned: true,
        quotations: { orderBy: { date: "desc" }, take: 1, select: { id: true, prefix: true, number: true, status: true, total: true, currency: true } },
      },
    }),
    db.lead.count({ where: filtered }),
  ]);
  return (
    <>
      {header}
      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          {filters}
          {stageChips}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No leads found" action={<ButtonLink href="/admin/leads/new">Add lead</ButtonLink>} />
        ) : (
          <Table head={["Name", "Contact", "Stage", "Quotation", "Next follow-up", "Value", "Source", "Assigned", "Created"]}>
            {rows.map((l) => {
              const st = stageOf(l);
              const q = l.quotations[0];
              return (
              <tr key={l.id} className="hover:bg-slate-50/60">
                <td className="td">
                  <Link href={`/admin/leads/${l.id}`} className="link font-medium">{l.name}</Link>
                  {l.company && <div className="text-xs text-slate-500">{l.company}</div>}
                </td>
                <td className="td text-xs">
                  <div>{l.email}</div>
                  <div className="text-slate-500">{l.phone}</div>
                </td>
                <td className="td whitespace-nowrap">
                  <Badge color={STAGE_INFO[st].color}>{STAGE_INFO[st].label}</Badge>
                  {l.lost && <span className="ml-1"><Badge tone="red">Lost</Badge></span>}
                  <div className="mt-1 text-[11px] text-slate-400">{l.status.name}</div>
                </td>
                <td className="td whitespace-nowrap text-xs">
                  {q ? (
                    <Link href={`/admin/quotations/${q.id}`} className="block hover:text-primary">
                      <span className="font-medium text-slate-700">{docNumber(q.prefix, q.number)}</span>
                      <span className={cx("ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", QUOTE_TONE[q.status] ?? "bg-slate-100 text-slate-600")}>
                        {q.status === "DRAFT" ? "Not sent" : q.status.toLowerCase()}
                      </span>
                      <div className="text-slate-500">{money(q.total, q.currency)}</div>
                    </Link>
                  ) : (
                    <Link href={`/admin/quotations/new?leadId=${l.id}`} className="font-medium text-amber-700 hover:underline">
                      Not created · Create
                    </Link>
                  )}
                </td>
                <td className="td whitespace-nowrap text-xs">
                  {st === "CUSTOMER" || st === "JUNK" ? (
                    <span className="text-slate-400">—</span>
                  ) : l.nextFollowUp ? (
                    <span className={l.nextFollowUp < today ? "font-semibold text-brand-red" : l.nextFollowUp < tomorrow ? "font-semibold text-amber-700" : "text-slate-600"}>
                      {l.nextFollowUp < today ? "Overdue · " : l.nextFollowUp < tomorrow ? "Today · " : ""}
                      {fmtDate(l.nextFollowUp)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not set</span>
                  )}
                  <div className="text-slate-400">
                    {l._count.followUps} follow-up{l._count.followUps === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="td">{l.value ? money(l.value, currency) : "—"}</td>
                <td className="td">{l.source?.name ?? "—"}</td>
                <td className="td">
                  {l.assigned ? (
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <Avatar name={`${l.assigned.firstName} ${l.assigned.lastName}`} size={24} />
                      {l.assigned.firstName}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="td whitespace-nowrap text-slate-500">{fmtDate(l.createdAt)}</td>
              </tr>
              );
            })}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}

const QUOTE_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-green-50 text-green-700",
  DECLINED: "bg-red-50 text-red-700",
};
