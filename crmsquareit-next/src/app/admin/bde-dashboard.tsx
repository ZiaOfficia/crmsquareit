import Link from "next/link";
import clsx from "clsx";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, Download, Phone, Plus, ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { fmtDate, money, timeAgo } from "@/lib/format";
import { docNumber } from "@/lib/sales";
import { QUOTATION_STATUS } from "@/lib/constants";
import { displayStatus, quotationScope } from "@/lib/quotations";
import { Badge, ButtonLink, Card, EmptyState, StatusBadge } from "@/components/ui";
import { TodoWidget } from "./todo-widget";

const DAY = 86_400_000;
/** A lead not contacted for this many days needs a follow-up. */
const FOLLOW_UP_DAYS = 7;

/** /admin for people in the BDE department: their leads, follow-ups and quotations.
 *  A BDE Team Lead sees the whole team's numbers; an Executive sees their own. */
export async function BdeDashboard({ user }: { user: CurrentUser }) {
  const isTL = user.memberships.some((m) => m.departmentCode === "BDE" && m.teamRole === "TL");
  const now = new Date();
  const today = new Date(now.toDateString());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const stale = new Date(today.getTime() - FOLLOW_UP_DAYS * DAY);

  const mine: Prisma.LeadWhereInput = isTL ? {} : { assignedId: user.id };
  const open: Prisma.LeadWhereInput = { ...mine, lost: false, junk: false, customerId: null };
  const qScope = quotationScope(user);

  const [settings, openLeads, newLeads, converted, followUps, statuses, quotes, qMonth, qWon, decided, todos] = await Promise.all([
    getSettings(),
    db.lead.aggregate({ where: open, _count: true, _sum: { value: true } }),
    db.lead.count({ where: { ...mine, createdAt: { gte: monthStart } } }),
    db.lead.count({ where: { ...mine, customerId: { not: null }, customer: { createdAt: { gte: monthStart } } } }),
    db.lead.findMany({
      where: { ...open, OR: [{ lastContact: null, createdAt: { lt: stale } }, { lastContact: { lt: stale } }] },
      orderBy: [{ lastContact: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: 8,
      include: { status: true, assigned: { select: { firstName: true } } },
    }),
    db.leadStatus.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: { where: open } } } } }),
    db.quotation.findMany({ where: qScope, orderBy: [{ date: "desc" }, { number: "desc" }], take: 6 }),
    db.quotation.aggregate({ where: { ...qScope, date: { gte: monthStart } }, _count: true, _sum: { total: true } }),
    db.quotation.aggregate({ where: { ...qScope, status: "ACCEPTED", updatedAt: { gte: monthStart } }, _count: true, _sum: { total: true } }),
    db.quotation.groupBy({ by: ["status"], where: { ...qScope, status: { in: ["ACCEPTED", "DECLINED"] } }, _count: true }),
    db.todo.findMany({ where: { staffId: user.id }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 20 }),
  ]);
  const cur = settings.currency;
  const acc = decided.find((d) => d.status === "ACCEPTED")?._count ?? 0;
  const dec = decided.find((d) => d.status === "DECLINED")?._count ?? 0;
  const winRate = acc + dec ? Math.round((acc / (acc + dec)) * 100) : null;
  const pipeline = statuses.filter((s) => s._count.leads > 0);
  const maxStage = Math.max(1, ...pipeline.map((s) => s._count.leads));
  const leadsHref = isTL ? "/admin/leads" : `/admin/leads?assigned=${user.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">BDE{isTL ? " · Team Lead" : ""}</p>
          <h1 className="text-2xl font-bold text-ink">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {user.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{isTL ? "Your team's leads and quotations." : "Your leads and quotations."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "leads", "create") && (
            <ButtonLink href="/admin/leads/new" variant="secondary">
              <Plus className="h-4 w-4" /> New lead
            </ButtonLink>
          )}
          {can(user, "quotations", "create") && (
            <ButtonLink href="/admin/quotations/new">
              <ScrollText className="h-4 w-4" /> New quotation
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={isTL ? "Open leads" : "My open leads"} value={openLeads._count} sub={openLeads._sum.value ? `${money(openLeads._sum.value, cur)} potential` : "in the pipeline"} href={leadsHref} />
        <Kpi label="New this month" value={newLeads} sub="leads added" href={leadsHref} />
        <Kpi label="Follow-ups due" value={followUps.length === 8 ? "8+" : followUps.length} sub={`not contacted in ${FOLLOW_UP_DAYS}+ days`} alert={followUps.length > 0} />
        <Kpi label="Quoted this month" value={money(qMonth._sum.total ?? 0, cur)} sub={`${qMonth._count} quotation${qMonth._count === 1 ? "" : "s"}`} href="/admin/quotations" />
        <Kpi label="Won this month" value={money(qWon._sum.total ?? 0, cur)} sub={`${qWon._count} accepted · ${converted} new customer${converted === 1 ? "" : "s"}`} href="/admin/quotations?status=ACCEPTED" good={qWon._count > 0} />
        <Kpi label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub={`${acc} won · ${dec} lost`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Follow up today" className="xl:col-span-2" actions={<Link href={leadsHref} className="link text-xs">All leads</Link>}>
          {followUps.length === 0 ? (
            <EmptyState title="You're on top of it" text={`Every open lead has been contacted in the last ${FOLLOW_UP_DAYS} days.`} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {followUps.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/leads/${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
                      {l.name}
                      {l.company && <span className="font-normal text-slate-500"> · {l.company}</span>}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge color={l.status.color}>{l.status.name}</Badge>
                      <span className="flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> {l.lastContact ? `Last contact ${timeAgo(l.lastContact)}` : `Never contacted · added ${timeAgo(l.createdAt)}`}
                      </span>
                      {isTL && l.assigned && <span>· {l.assigned.firstName}</span>}
                      {l.value > 0 && <span>· {money(l.value, cur)}</span>}
                    </p>
                  </div>
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary" title={`Call ${l.phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {can(user, "quotations", "create") && (
                    <Link href={`/admin/quotations/new?leadId=${l.id}`} className="text-xs font-medium text-primary hover:underline">
                      Quote
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pipeline" actions={<Link href="/admin/leads?view=kanban" className="link text-xs">Open board</Link>}>
          {pipeline.length === 0 ? (
            <EmptyState title="No open leads" />
          ) : (
            <ul className="space-y-3 p-5">
              {pipeline.map((s) => (
                <li key={s.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="tabular-nums text-slate-500">{s._count.leads}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(s._count.leads / maxStage) * 100}%`, backgroundColor: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent quotations" className="xl:col-span-2" actions={<Link href="/admin/quotations" className="link text-xs">All quotations</Link>}>
          {quotes.length === 0 ? (
            <EmptyState
              title="No quotations yet"
              text="Make one from a lead and download it as a PDF to send."
              action={can(user, "quotations", "create") ? <ButtonLink href="/admin/quotations/new" variant="secondary">New quotation</ButtonLink> : undefined}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotes.map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/quotations/${q.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
                      {docNumber(q.prefix, q.number)} · {q.clientCompany || q.clientName}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {q.subject} · {fmtDate(q.date)}
                    </p>
                  </div>
                  <span className={clsx("shrink-0 text-sm font-semibold tabular-nums")}>{money(q.total, q.currency)}</span>
                  <StatusBadge map={QUOTATION_STATUS} value={displayStatus(q)} />
                  <a href={`/admin/quotations/${q.id}/pdf`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Download PDF">
                    <Download className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <TodoWidget todos={todos.map((t) => ({ id: t.id, text: t.text, done: t.done }))} />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, alert, good, href }: { label: string; value: React.ReactNode; sub?: string; alert?: boolean; good?: boolean; href?: string }) {
  const inner = (
    <div className={clsx("card h-full p-4 transition", href && "hover:shadow-md", alert && "border-amber-200")}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx("mt-1.5 truncate text-xl font-bold", alert ? "text-amber-600" : good ? "text-brand-green" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
