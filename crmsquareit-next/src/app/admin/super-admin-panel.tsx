import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CheckSquare, Clock, FileText, LayoutGrid, Megaphone, Pin, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, fmtDate, timeAgo } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { audienceLabel, readStats, staffDirectory } from "@/lib/announcements";
import { can } from "@/lib/permissions";
import { isLocked, monthKey, officeCategoryLabel, parseMonth, REPORT_STATUS, shiftMonth } from "@/lib/office-expenses";
import { Avatar, Badge, ButtonLink, Card, EmptyState, StatusBadge } from "@/components/ui";
import { LiveRefresh } from "@/components/announcements";

const DAY = 86_400_000;

type Dept = { id: number; code: string; name: string; children: { id: number; code: string; name: string }[] };
type OpenTask = { id: number; name: string; status: string; priority: string; dueDate: Date | null; project: { name: string } | null; assignees: { id: number; firstName: string; lastName: string }[] };

/** Office expenses tab key. Lower-case so it can't clash with a department code. */
const OFFICE_TAB = "office";

/** Minimal, live control panel shown on /admin to Super Admins and HR.
 *  HR sees the same "who is doing what" view, plus their own announcements and quick actions. */
export async function SuperAdminPanel({ user, tab }: { user: CurrentUser; tab?: string }) {
  const hr = !user.isAdmin && user.isHR;
  const now = new Date();
  const today = new Date(now.toDateString());
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [settings, dir, depts, openTasks, doneThisWeek, openTickets, leadsThisMonth, paidThisMonth, activeProjects, announcements, pendingReports] = await Promise.all([
    getSettings(),
    staffDirectory(),
    db.orgDepartment.findMany({
      where: { active: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true, children: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } } },
    }),
    db.task.findMany({
      where: { status: { not: "COMPLETE" } },
      select: { id: true, name: true, status: true, priority: true, dueDate: true, project: { select: { name: true } }, assignees: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.task.findMany({ where: { status: "COMPLETE", completedAt: { gte: weekAgo } }, select: { assignees: { select: { id: true } } } }),
    db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.lead.count({ where: { createdAt: { gte: monthStart } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
    db.project.count({ where: { status: "IN_PROGRESS" } }),
    db.announcement.findMany({
      // HR manages (and sees receipts for) the announcements they sent.
      where: hr ? { createdById: user.id } : {},
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { departments: { select: { id: true, name: true } }, recipients: { select: { id: true, firstName: true, lastName: true } }, reads: { select: { staffId: true } } },
    }),
    user.isAdmin ? db.officeExpenseReport.findMany({ where: { status: "SUBMITTED" }, orderBy: { month: "asc" }, select: { month: true, total: true } }) : [],
  ]);

  const isOverdue = (t: { dueDate: Date | null }) => !!t.dueDate && t.dueDate < today;
  /** Work numbers for a group of people. A task shared by several of them counts once. */
  const workFor = (ids: Set<number>) => {
    const open = openTasks.filter((t) => t.assignees.some((a) => ids.has(a.id)));
    return {
      open,
      overdue: open.filter(isOverdue).length,
      done: doneThisWeek.filter((t) => t.assignees.some((a) => ids.has(a.id))).length,
    };
  };
  const membersOf = (d: Dept) => dir.filter((s) => s.deptIds.includes(d.id));
  const onlineToday = (people: typeof dir) => people.filter((s) => s.lastLogin && s.lastLogin >= today).length;

  const active = depts.find((d) => d.code === tab);
  const showOffice = tab === OFFICE_TAB && can(user, "office_expenses");
  const tabs = [
    { code: "", name: "Overview" },
    ...depts.map((d) => ({ code: d.code, name: d.name })),
    ...(can(user, "office_expenses") ? [{ code: OFFICE_TAB, name: "Office expenses" }] : []),
  ];
  const current = showOffice ? OFFICE_TAB : active?.code ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{hr ? "HR" : "Super Admin"}</p>
          <h1 className="text-2xl font-bold text-ink">{hr ? "HR dashboard" : "Control panel"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveRefresh />
          <Link href="/admin?classic=1" className="text-xs font-medium text-slate-500 hover:text-primary">
            Classic dashboard
          </Link>
          {hr && (
            <>
              {can(user, "staff", "create") && (
                <ButtonLink href="/admin/staff/new" variant="secondary">
                  <UserPlus className="h-4 w-4" /> Add staff
                </ButtonLink>
              )}
              {can(user, "tasks", "create") && (
                <ButtonLink href="/admin/tasks/new" variant="secondary">
                  <CheckSquare className="h-4 w-4" /> New task
                </ButtonLink>
              )}
              {can(user, "invoices", "create") && (
                <ButtonLink href="/admin/invoices/new" variant="secondary">
                  <FileText className="h-4 w-4" /> New invoice
                </ButtonLink>
              )}
              {can(user, "office_expenses", "create") && (
                <ButtonLink href="/admin/office-expenses" variant="secondary">
                  <Building2 className="h-4 w-4" /> Office expense
                </ButtonLink>
              )}
            </>
          )}
          <ButtonLink href={active ? `/admin/announcements?dept=${active.id}` : "/admin/announcements"}>
            <Megaphone className="h-4 w-4" /> {active ? `Announce to ${active.name}` : "New announcement"}
          </ButtonLink>
        </div>
      </div>

      {pendingReports.length > 0 && (
        <Link href={`/admin/office-expenses?month=${pendingReports[0].month}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <Building2 className="h-4 w-4" />
          <span>
            HR submitted office expenses for{" "}
            <strong>{pendingReports.map((r) => `${parseMonth(r.month).label} (${money(r.total, settings.currency)})`).join(", ")}</strong>. Waiting for your review.
          </span>
          <span className="ml-auto font-semibold underline">Review</span>
        </Link>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Online today" value={`${onlineToday(dir)}/${dir.length}`} sub="active staff logged in" href="/admin/staff" />
        <Kpi label="Open tasks" value={openTasks.length} sub={`${openTasks.filter(isOverdue).length} overdue`} alert={openTasks.some(isOverdue)} href="/admin/tasks" />
        <Kpi label="Done this week" value={doneThisWeek.length} sub="tasks completed" href="/admin/tasks?status=COMPLETE" />
        <Kpi label="Active projects" value={activeProjects} sub="in progress" href="/admin/projects" />
        <Kpi label="Open tickets" value={openTickets} sub="support" alert={openTickets > 0} href="/admin/tickets" />
        <Kpi label="This month" value={money(paidThisMonth._sum.amount ?? 0, settings.currency)} sub={`${leadsThisMonth} new leads`} href="/admin/payments" />
      </div>

      {/* Department tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <nav className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((t) => {
            const on = current === t.code;
            const d = depts.find((x) => x.code === t.code);
            const overdue = d ? workFor(new Set(membersOf(d).map((s) => s.id))).overdue : 0;
            return (
              <Link
                key={t.code || "overview"}
                href={t.code ? `/admin?tab=${t.code}` : "/admin"}
                scroll={false}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  on ? "bg-sidebar text-white shadow" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {!t.code && <LayoutGrid className="h-4 w-4" />}
                {t.name}
                {overdue > 0 && <span className={clsx("rounded-full px-1.5 text-[10px] font-bold", on ? "bg-brand-red text-white" : "bg-red-100 text-red-700")}>{overdue}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {showOffice ? (
        <OfficeTab user={user} currency={settings.currency} />
      ) : active ? (
        <DepartmentTab dept={active} dir={dir} announcements={announcements} openTasks={openTasks} workFor={workFor} today={today} />
      ) : (
        <Overview depts={depts} dir={dir} announcements={announcements} workFor={workFor} membersOf={membersOf} onlineToday={onlineToday} announcementsTitle={hr ? "Your announcements" : undefined} />
      )}
    </div>
  );
}

type Dir = Awaited<ReturnType<typeof staffDirectory>>;
type Ann = { id: number; title: string; urgent: boolean; pinned: boolean; createdAt: Date; expiresAt: Date | null; audience: string; createdById: number | null; departments: { id: number; name: string }[]; recipients: { id: number; firstName: string; lastName: string }[]; reads: { staffId: number }[] };
type WorkFor = (ids: Set<number>) => { open: OpenTask[]; overdue: number; done: number };

async function Overview({ depts, dir, announcements, workFor, membersOf, onlineToday, announcementsTitle }: { depts: Dept[]; dir: Dir; announcements: Ann[]; workFor: WorkFor; membersOf: (d: Dept) => Dir; onlineToday: (p: Dir) => number; announcementsTitle?: string }) {
  const activity = await db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { staff: { select: { firstName: true, lastName: true } } } });
  const unassigned = dir.filter((s) => !s.isAdmin && s.deptIds.length === 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {depts.map((d) => {
          const people = membersOf(d);
          const w = workFor(new Set(people.map((s) => s.id)));
          return (
            <Link key={d.id} href={`/admin?tab=${d.code}`} scroll={false} className="card group p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.children.length ? d.children.map((c) => c.name).join(" · ") : `${people.length} ${people.length === 1 ? "person" : "people"}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label="Open" value={w.open.length} />
                <Mini label="Overdue" value={w.overdue} tone={w.overdue ? "red" : undefined} />
                <Mini label="Done 7d" value={w.done} tone={w.done ? "green" : undefined} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {people.slice(0, 5).map((s) => (
                    <Avatar key={s.id} name={s.name} size={24} />
                  ))}
                  {people.length > 5 && <span className="z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white">+{people.length - 5}</span>}
                </div>
                <span className="text-[11px] text-slate-400">{people.length ? `${onlineToday(people)} online today` : "No one yet"}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <UserPlus className="h-4 w-4" />
          <span>
            <strong>{unassigned.length}</strong> active {unassigned.length === 1 ? "person isn't" : "people aren't"} in a department:{" "}
            {unassigned.slice(0, 6).map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/admin/staff/${s.id}`} className="underline">{s.name}</Link>
              </span>
            ))}
            {unassigned.length > 6 && ` +${unassigned.length - 6}`}
          </span>
          <Link href="/admin/staff?view=departments" className="ml-auto font-semibold underline">
            Assign
          </Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <AnnouncementsCard announcements={announcements.slice(0, 6)} dir={dir} href="/admin/announcements" title={announcementsTitle} />
        <ActivityCard activity={activity} />
      </div>
    </>
  );
}

async function DepartmentTab({ dept, dir, announcements, openTasks, workFor, today }: { dept: Dept; dir: Dir; announcements: Ann[]; openTasks: OpenTask[]; workFor: WorkFor; today: Date }) {
  const deptIds = [dept.id, ...dept.children.map((c) => c.id)];
  const members = await db.departmentMember.findMany({
    where: { departmentId: { in: deptIds }, staff: { active: true } },
    include: { staff: { select: { id: true, firstName: true, lastName: true, lastLogin: true, email: true } }, department: { select: { name: true, sortOrder: true } } },
  });
  // TLs first, then by sub-department and name.
  members.sort((a, b) => (a.teamRole === b.teamRole ? 0 : a.teamRole === "TL" ? -1 : 1) || a.department.sortOrder - b.department.sortOrder || a.staff.firstName.localeCompare(b.staff.firstName));
  const ids = new Set(members.map((m) => m.staffId));
  const w = workFor(ids);
  const activity = ids.size
    ? await db.activity.findMany({ where: { staffId: { in: [...ids] } }, orderBy: { createdAt: "desc" }, take: 12, include: { staff: { select: { firstName: true, lastName: true } } } })
    : [];
  const deptAnnouncements = announcements.filter((a) => a.audience === "ALL" || a.departments.some((d) => deptIds.includes(d.id)) || a.recipients.some((r) => ids.has(r.id)));
  const tasks = [...w.open].sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)).slice(0, 10);
  const perPerson = (id: number) => {
    const open = openTasks.filter((t) => t.assignees.some((a) => a.id === id));
    return { open: open.length, overdue: open.filter((t) => t.dueDate && t.dueDate < today).length, done: workFor(new Set([id])).done };
  };
  const tls = members.filter((m) => m.teamRole === "TL").length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Team" value={members.length} sub={`${tls} TL · ${members.length - tls} Executive`} />
        <Kpi label="Open tasks" value={w.open.length} sub="assigned to this team" />
        <Kpi label="Overdue" value={w.overdue} sub="past due date" alert={w.overdue > 0} />
        <Kpi label="Done this week" value={w.done} sub="tasks completed" />
      </div>

      <Card title={`${dept.name} team`} actions={<Link href="/admin/staff?view=departments" className="link text-xs">Manage members</Link>}>
        {members.length === 0 ? (
          <EmptyState title={`No one in ${dept.name} yet`} text="Add TLs and Executives from the Departments page." action={<ButtonLink href="/admin/staff?view=departments" variant="secondary">Assign people</ButtonLink>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Person</th>
                  <th className="th">Role</th>
                  {dept.children.length > 0 && <th className="th">Team</th>}
                  <th className="th">Last seen</th>
                  <th className="th text-right">Open</th>
                  <th className="th text-right">Overdue</th>
                  <th className="th text-right">Done 7d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const p = perPerson(m.staffId);
                  const name = `${m.staff.firstName} ${m.staff.lastName}`.trim();
                  const online = m.staff.lastLogin && m.staff.lastLogin >= today;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <Link href={`/admin/staff/${m.staffId}`} className="flex items-center gap-3">
                          <span className="relative">
                            <Avatar name={name} size={30} />
                            {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-green ring-2 ring-white" />}
                          </span>
                          <span>
                            <span className="block font-medium text-slate-800 hover:text-primary">{name}</span>
                            <span className="block text-xs text-slate-400">{m.staff.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="td">{m.teamRole === "TL" ? <Badge tone="purple">TL</Badge> : <Badge>Executive</Badge>}</td>
                      {dept.children.length > 0 && <td className="td">{m.department.name}</td>}
                      <td className="td text-xs text-slate-500">{m.staff.lastLogin ? timeAgo(m.staff.lastLogin) : "Never"}</td>
                      <td className="td text-right font-medium">{p.open}</td>
                      <td className={clsx("td text-right font-medium", p.overdue && "text-brand-red")}>{p.overdue}</td>
                      <td className={clsx("td text-right font-medium", p.done && "text-brand-green")}>{p.done}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Open work" actions={<Link href="/admin/tasks" className="link text-xs">All tasks</Link>}>
          {tasks.length === 0 ? (
            <EmptyState title="No open tasks" text={members.length ? "Nothing assigned to this team right now." : undefined} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/admin/tasks/${t.id}`} className="text-sm font-medium text-slate-800 hover:text-primary">
                      {t.name}
                    </Link>
                    {t.dueDate && (
                      <span className={clsx("flex shrink-0 items-center gap-1 text-xs", t.dueDate < today ? "font-semibold text-brand-red" : "text-slate-500")}>
                        {t.dueDate < today ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {fmtDate(t.dueDate)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge map={TASK_STATUS} value={t.status} />
                    <StatusBadge map={PRIORITY} value={t.priority} />
                    {t.project && <span>{t.project.name}</span>}
                    <span className="ml-auto">{t.assignees.filter((a) => ids.has(a.id)).map((a) => a.firstName).join(", ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <AnnouncementsCard announcements={deptAnnouncements.slice(0, 6)} dir={dir} href={`/admin/announcements?dept=${dept.id}`} hrefLabel={`Announce to ${dept.name}`} />
      </div>

      <ActivityCard activity={activity} empty={`Actions by ${dept.name} people will appear here.`} />
    </>
  );
}

async function OfficeTab({ user, currency }: { user: CurrentUser; currency: string }) {
  const m = parseMonth(monthKey(new Date()));
  const prev = parseMonth(shiftMonth(m.key, -1));
  const [rows, prevSum, reports] = await Promise.all([
    db.officeExpense.findMany({ where: { date: { gte: m.start, lt: m.end } }, orderBy: [{ date: "desc" }, { id: "desc" }], include: { createdBy: { select: { firstName: true } } } }),
    db.officeExpense.aggregate({ _sum: { amount: true }, where: { date: { gte: prev.start, lt: prev.end } } }),
    db.officeExpenseReport.findMany({ orderBy: { month: "desc" }, take: 6 }),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const prevTotal = prevSum._sum.amount ?? 0;
  const totals: Record<string, number> = {};
  for (const r of rows) totals[r.category] = (totals[r.category] ?? 0) + r.amount;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const status = (k: string) => reports.find((r) => r.month === k)?.status ?? "OPEN";
  const prevStatus = status(prev.key);
  // HR: remind them to submit last month once it's over.
  const remind = !user.isAdmin && !isLocked(prevStatus) && prevTotal > 0;

  return (
    <>
      {remind && (
        <Link href={`/admin/office-expenses?month=${prev.key}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {prev.label} ({money(prevTotal, currency)}) {prevStatus === "RETURNED" ? "was sent back by the Super Admin" : "has not been submitted to the Super Admin yet"}.
          </span>
          <span className="ml-auto font-semibold underline">{prevStatus === "RETURNED" ? "Fix and resubmit" : "Submit now"}</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={m.label} value={money(total, currency)} sub={`${rows.length} ${rows.length === 1 ? "entry" : "entries"} so far`} href="/admin/office-expenses" />
        <Kpi label={prev.label} value={money(prevTotal, currency)} sub={REPORT_STATUS[prevStatus].label} alert={prevStatus === "SUBMITTED" && user.isAdmin} href={`/admin/office-expenses?month=${prev.key}`} />
        <Kpi label="Biggest category" value={top ? officeCategoryLabel(top[0]) : "—"} sub={top ? money(top[1], currency) : "Nothing yet"} />
        <Kpi label="This month's report" value={REPORT_STATUS[status(m.key)].label} sub="submitted at month end" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Latest entries · ${m.label}`} actions={<Link href="/admin/office-expenses" className="link text-xs">Open office expenses</Link>}>
          {rows.length === 0 ? (
            <EmptyState title="Nothing recorded this month" action={can(user, "office_expenses", "create") ? <ButtonLink href="/admin/office-expenses" variant="secondary">Add an expense</ButtonLink> : undefined} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{r.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {officeCategoryLabel(r.category)} · {fmtDate(r.date)}
                      {r.createdBy && ` · ${r.createdBy.firstName}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{money(r.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Monthly reports" actions={<Link href="/admin/office-expenses" className="link text-xs">All months</Link>}>
          {reports.length === 0 ? (
            <EmptyState title="No months submitted yet" text="HR submits each month's office expenses to the Super Admin at month end." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/office-expenses?month=${r.month}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                    <span className="font-medium text-slate-700">{parseMonth(r.month).label}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-600">{money(r.total, currency)}</span>
                      <StatusBadge map={REPORT_STATUS} value={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function AnnouncementsCard({ announcements, dir, href, hrefLabel = "New announcement", title = "Announcements" }: { announcements: Ann[]; dir: Dir; href: string; hrefLabel?: string; title?: string }) {
  const now = new Date();
  return (
    <Card title={title} actions={<Link href={href} className="link text-xs">{hrefLabel}</Link>}>
      {announcements.length === 0 ? (
        <EmptyState title="Nothing announced yet" action={<ButtonLink href={href} variant="secondary"><Megaphone className="h-4 w-4" /> {hrefLabel}</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {announcements.map((a) => {
            const s = readStats(a, dir);
            const expired = !!a.expiresAt && a.expiresAt < now;
            return (
              <li key={a.id}>
                <Link href={`/admin/announcements/${a.id}`} className={clsx("flex items-center gap-3 px-5 py-3 hover:bg-slate-50", expired && "opacity-50")}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      {a.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                      {a.urgent && <span className="rounded bg-red-100 px-1 text-[10px] font-bold uppercase text-red-700">Urgent</span>}
                      <span className="truncate">{a.title}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      To {audienceLabel(a)} · {timeAgo(a.createdAt)}
                      {expired && " · expired"}
                    </p>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <p className={clsx("flex items-center justify-end gap-1 text-xs font-semibold", s.pct === 100 ? "text-brand-green" : "text-slate-700")}>
                      {s.pct === 100 && <CheckCircle2 className="h-3 w-3" />}
                      {s.read}/{s.total}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={clsx("h-full rounded-full", s.pct === 100 ? "bg-brand-green" : "bg-primary")} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ActivityCard({ activity, empty = "Actions across the CRM will appear here." }: { activity: { id: number; description: string; createdAt: Date; staff: { firstName: string; lastName: string } | null }[]; empty?: string }) {
  return (
    <Card title="Live activity">
      {activity.length === 0 ? (
        <EmptyState title="No activity yet" text={empty} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {activity.map((a) => {
            const name = a.staff ? `${a.staff.firstName} ${a.staff.lastName}`.trim() : "System";
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Avatar name={name} size={26} />
                <span className="min-w-0 flex-1 text-slate-700">
                  <span className="font-semibold">{name}</span> {a.description}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Kpi({ label, value, sub, alert, href }: { label: string; value: React.ReactNode; sub?: string; alert?: boolean; href?: string }) {
  const inner = (
    <div className={clsx("card h-full p-4 transition", href && "hover:shadow-md", alert && "border-red-200")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx("mt-1.5 truncate text-xl font-bold", alert ? "text-brand-red" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "red" | "green" }) {
  return (
    <div className="rounded-lg bg-slate-50 py-1.5">
      <p className={clsx("text-lg font-bold leading-tight", tone === "red" ? "text-brand-red" : tone === "green" ? "text-brand-green" : "text-slate-800")}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
