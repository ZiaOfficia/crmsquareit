import Link from "next/link";
import clsx from "clsx";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, ArrowRight, CalendarClock, Download, MessageSquare, Phone, Plus, ScrollText, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { fmtDate, money, timeAgo } from "@/lib/format";
import { docNumber } from "@/lib/sales";
import { QUOTATION_STATUS } from "@/lib/constants";
import { displayStatus, quotationScope } from "@/lib/quotations";
import { LEAD_STAGES, STAGE_INFO, stageInclude, stageOf, stageWhere, type LeadStage } from "@/lib/lead-flow";
import { Badge, ButtonLink, Card, EmptyState, StatusBadge, btn } from "@/components/ui";
import { StageButtons } from "@/components/lead-flow";
import { convertLead } from "./leads/actions";
import { TodoWidget } from "./todo-widget";

const DAY = 86_400_000;
/** A lead not contacted for this many days needs a follow-up, even without a date set. */
const FOLLOW_UP_DAYS = 7;

/** /admin for people in the BDE department, built around the lead flow:
 *  New lead → Quotation sent → Follow-up → Hot / Cold / Junk → Customer.
 *  A BDE Team Lead sees the whole team; an Executive sees their own leads. */
export async function BdeDashboard({ user, stage: stageParam }: { user: CurrentUser; stage?: string }) {
  const isTL = user.memberships.some((m) => m.departmentCode === "BDE" && m.teamRole === "TL");
  const now = new Date();
  const today = new Date(now.toDateString());
  const endOfToday = new Date(today.getTime() + DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const stale = new Date(today.getTime() - FOLLOW_UP_DAYS * DAY);

  const mine: Prisma.LeadWhereInput = isTL ? {} : { assignedId: user.id };
  const open: Prisma.LeadWhereInput = { ...mine, lost: false, junk: false, customerId: null };
  const qScope = quotationScope(user);
  const scoped = (s: LeadStage): Prisma.LeadWhereInput => ({ AND: [mine, stageWhere(s)] });

  const [settings, stageTotals, newLeads, converted, allLeads, followUps, quotes, qMonth, qWon, todos] = await Promise.all([
    getSettings(),
    Promise.all(LEAD_STAGES.map((s) => db.lead.aggregate({ where: scoped(s), _count: true, _sum: { value: true } }))),
    db.lead.count({ where: { ...mine, createdAt: { gte: monthStart } } }),
    db.lead.count({ where: { ...mine, customerId: { not: null }, customer: { createdAt: { gte: monthStart } } } }),
    db.lead.count({ where: mine }),
    db.lead.findMany({
      where: {
        ...open,
        OR: [
          { nextFollowUp: { lt: endOfToday } },
          { nextFollowUp: null, lastContact: null, createdAt: { lt: stale } },
          { nextFollowUp: null, lastContact: { lt: stale } },
        ],
      },
      orderBy: [{ nextFollowUp: { sort: "asc", nulls: "last" } }, { lastContact: { sort: "asc", nulls: "first" } }],
      take: 8,
      include: { ...stageInclude, assigned: { select: { firstName: true } } },
    }),
    db.quotation.findMany({ where: qScope, orderBy: [{ date: "desc" }, { number: "desc" }], take: 6 }),
    db.quotation.aggregate({ where: { ...qScope, date: { gte: monthStart } }, _count: true, _sum: { total: true } }),
    db.quotation.aggregate({ where: { ...qScope, status: "ACCEPTED", updatedAt: { gte: monthStart } }, _count: true, _sum: { total: true } }),
    db.todo.findMany({ where: { staffId: user.id }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 20 }),
  ]);
  const cur = settings.currency;
  const totals = Object.fromEntries(LEAD_STAGES.map((s, i) => [s, { count: stageTotals[i]._count, value: stageTotals[i]._sum.value ?? 0 }])) as Record<
    LeadStage,
    { count: number; value: number }
  >;
  const openCount = totals.NEW.count + totals.QUOTED.count + totals.FOLLOW_UP.count + totals.HOT.count + totals.COLD.count;
  const conversion = allLeads ? Math.round((totals.CUSTOMER.count / allLeads) * 100) : null;

  // The stage listed below the flow: ?tab=STAGE, else the stage that most needs attention.
  const stage: LeadStage = (LEAD_STAGES as readonly string[]).includes(stageParam ?? "")
    ? (stageParam as LeadStage)
    : ((["FOLLOW_UP", "QUOTED", "NEW", "HOT"] as const).find((s) => totals[s].count > 0) ?? "NEW");
  const stageLeads = await db.lead.findMany({
    where: scoped(stage),
    orderBy: stage === "FOLLOW_UP" || stage === "COLD" ? [{ nextFollowUp: { sort: "asc", nulls: "last" } }] : [{ createdAt: "desc" }],
    take: 15,
    include: {
      ...stageInclude,
      assigned: { select: { firstName: true } },
      customer: { select: { id: true, company: true } },
      quotations: { orderBy: { date: "desc" }, take: 1, select: { id: true, prefix: true, number: true, total: true, currency: true, status: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1, select: { note: true, createdAt: true } },
    },
  });
  const leadsHref = isTL ? "/admin/leads" : `/admin/leads?assigned=${user.id}`;
  const canQuote = can(user, "quotations", "create");
  const canEdit = can(user, "leads", "edit");
  const canConvert = can(user, "customers", "create");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">BDE{isTL ? " · Team Lead" : ""}</p>
          <h1 className="text-2xl font-bold text-ink">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {user.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{isTL ? "Your team's lead flow, from first contact to customer." : "Your leads, from first contact to customer."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "leads", "create") && (
            <ButtonLink href="/admin/leads/new" variant="secondary">
              <Plus className="h-4 w-4" /> New lead
            </ButtonLink>
          )}
          {canQuote && (
            <ButtonLink href="/admin/quotations/new">
              <ScrollText className="h-4 w-4" /> New quotation
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={isTL ? "Open leads" : "My open leads"} value={openCount} sub={`${newLeads} new this month`} href={leadsHref} />
        <Kpi label="Follow-ups due" value={followUps.length === 8 ? "8+" : followUps.length} sub="today or overdue" alert={followUps.length > 0} />
        <Kpi label="Hot leads" value={totals.HOT.count} sub={totals.HOT.value ? `${money(totals.HOT.value, cur)} potential` : "ready to close"} href="/admin?tab=HOT" />
        <Kpi label="Quoted this month" value={money(qMonth._sum.total ?? 0, cur)} sub={`${qMonth._count} quotation${qMonth._count === 1 ? "" : "s"}`} href="/admin/quotations" />
        <Kpi
          label="Won this month"
          value={money(qWon._sum.total ?? 0, cur)}
          sub={`${qWon._count} accepted · ${converted} new customer${converted === 1 ? "" : "s"}`}
          good={qWon._count > 0 || converted > 0}
        />
        <Kpi label="Lead → customer" value={conversion === null ? "—" : `${conversion}%`} sub={`${totals.CUSTOMER.count} of ${allLeads} leads converted`} />
      </div>

      <Card title="Lead flow" actions={<span className="hidden text-xs text-slate-500 sm:inline">Click a stage to see its leads</span>}>
        <div className="flex flex-col items-stretch gap-2 p-4 lg:flex-row lg:items-center">
          <StageTile stage="NEW" step={1} total={totals.NEW} active={stage} cur={cur} />
          <Arrow />
          <StageTile stage="QUOTED" step={2} total={totals.QUOTED} active={stage} cur={cur} />
          <Arrow />
          <StageTile stage="FOLLOW_UP" step={3} total={totals.FOLLOW_UP} active={stage} cur={cur} />
          <Arrow />
          <div className="grid gap-2 sm:grid-cols-3 lg:flex-[3]">
            <StageTile stage="HOT" step={4} total={totals.HOT} active={stage} cur={cur} />
            <StageTile stage="COLD" step={4} total={totals.COLD} active={stage} cur={cur} />
            <StageTile stage="JUNK" step={4} total={totals.JUNK} active={stage} cur={cur} />
          </div>
          <Arrow />
          <StageTile stage="CUSTOMER" step={5} total={totals.CUSTOMER} active={stage} cur={cur} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_INFO[stage].color }} />
              {STAGE_INFO[stage].label} <span className="font-normal text-slate-400">· {totals[stage].count}</span>
            </span>
          }
          actions={<span className="text-xs text-slate-500">Next: {STAGE_INFO[stage].next}</span>}
        >
          {stageLeads.length === 0 ? (
            <EmptyState title={`No leads in ${STAGE_INFO[stage].label.toLowerCase()}`} text={EMPTY_TEXT[stage]} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stageLeads.map((l) => {
                const q = l.quotations[0];
                const last = l.followUps[0];
                const s = stageOf(l);
                return (
                  <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/leads/${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
                        {l.name}
                        {l.company && <span className="font-normal text-slate-500"> · {l.company}</span>}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {l.value > 0 && <span className="font-medium text-slate-700">{money(l.value, cur)}</span>}
                        {q && (
                          <Link href={`/admin/quotations/${q.id}`} className="hover:text-primary">
                            {docNumber(q.prefix, q.number)} · {money(q.total, q.currency)} · {q.status.toLowerCase()}
                          </Link>
                        )}
                        {l.nextFollowUp && s !== "CUSTOMER" && s !== "JUNK" && (
                          <span className={clsx("flex items-center gap-1", l.nextFollowUp < endOfToday && "font-semibold text-amber-700")}>
                            <CalendarClock className="h-3 w-3" /> {fmtDate(l.nextFollowUp)}
                          </span>
                        )}
                        {last?.note && <span className="max-w-xs truncate">“{last.note}”</span>}
                        {!last && l.lastContact && <span>contacted {timeAgo(l.lastContact)}</span>}
                        {isTL && l.assigned && <span>· {l.assigned.firstName}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {l.phone && s !== "CUSTOMER" && (
                        <a href={`tel:${l.phone}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title={`Call ${l.phone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {s === "NEW" && canQuote && (
                        <ButtonLink href={q ? `/admin/quotations/${q.id}` : `/admin/quotations/new?leadId=${l.id}`} className="px-2.5 py-1 text-xs">
                          <ScrollText className="h-3.5 w-3.5" /> {q ? "Send quotation" : "Create quotation"}
                        </ButtonLink>
                      )}
                      {(s === "QUOTED" || s === "FOLLOW_UP" || s === "COLD") && canEdit && (
                        <ButtonLink href={`/admin/leads/${l.id}#follow-up`} variant={s === "QUOTED" ? "primary" : "secondary"} className="px-2.5 py-1 text-xs">
                          <MessageSquare className="h-3.5 w-3.5" /> Follow up
                        </ButtonLink>
                      )}
                      {(s === "FOLLOW_UP" || s === "HOT" || s === "COLD" || s === "JUNK") && canEdit && <StageButtons id={l.id} stage={s} compact />}
                      {s === "HOT" && canConvert && (
                        <form action={convertLead}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className={btn("success", "px-2.5 py-1 text-xs")}>
                            <UserCheck className="h-3.5 w-3.5" /> Convert
                          </button>
                        </form>
                      )}
                      {s === "CUSTOMER" && l.customer && (
                        <ButtonLink href={`/admin/customers/${l.customer.id}`} variant="secondary" className="px-2.5 py-1 text-xs">
                          View customer
                        </ButtonLink>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {totals[stage].count > stageLeads.length && (
            <p className="border-t border-slate-100 px-5 py-2.5 text-center text-xs text-slate-500">
              Showing {stageLeads.length} of {totals[stage].count} ·{" "}
              <Link href={leadsHref} className="link">
                all leads
              </Link>
            </p>
          )}
        </Card>

        <Card title="Follow up today" actions={<Link href={leadsHref} className="link text-xs">All leads</Link>}>
          {followUps.length === 0 ? (
            <EmptyState title="You're on top of it" text="No follow-ups due today." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {followUps.map((l) => {
                const s = stageOf(l);
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/leads/${l.id}#follow-up`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
                        {l.name}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge color={STAGE_INFO[s].color}>{STAGE_INFO[s].short}</Badge>
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {l.nextFollowUp
                            ? l.nextFollowUp < today
                              ? `Overdue since ${fmtDate(l.nextFollowUp)}`
                              : "Due today"
                            : l.lastContact
                              ? `Last contact ${timeAgo(l.lastContact)}`
                              : "Never contacted"}
                        </span>
                        {isTL && l.assigned && <span>· {l.assigned.firstName}</span>}
                      </p>
                    </div>
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary" title={`Call ${l.phone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                );
              })}
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
              action={canQuote ? <ButtonLink href="/admin/quotations/new" variant="secondary">New quotation</ButtonLink> : undefined}
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
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(q.total, q.currency)}</span>
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

const EMPTY_TEXT: Record<LeadStage, string> = {
  NEW: "New leads wait here until a quotation is sent to them.",
  QUOTED: "Leads with a sent quotation wait here for their first follow-up.",
  FOLLOW_UP: "Leads being followed up stay here until you mark them hot, cold or junk.",
  HOT: "Mark a lead hot after a promising follow-up.",
  COLD: "Leads that aren't ready yet. Keep nurturing them.",
  JUNK: "Fake, duplicate or irrelevant leads.",
  CUSTOMER: "Convert a hot lead once the client confirms.",
};

function StageTile({ stage, step, total, active, cur }: { stage: LeadStage; step: number; total: { count: number; value: number }; active: LeadStage; cur: string }) {
  const info = STAGE_INFO[stage];
  const on = stage === active;
  return (
    <Link
      href={`/admin?tab=${stage}`}
      scroll={false}
      className={clsx("relative min-w-0 flex-1 overflow-hidden rounded-xl border p-3 pt-4 transition hover:shadow-md", on ? "border-transparent" : "border-slate-200 bg-white")}
      style={on ? { backgroundColor: `${info.color}14`, boxShadow: `0 0 0 2px ${info.color}` } : undefined}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: info.color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Step {step}</p>
      <p className="truncate text-xs font-semibold text-slate-700">{info.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: info.color }}>
        {total.count}
      </p>
      <p className="truncate text-[11px] text-slate-500">{total.value ? money(total.value, cur) : " "}</p>
    </Link>
  );
}

function Arrow() {
  return <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-slate-300 lg:rotate-0" />;
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
