import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { money, fmtDate, timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Card, Stat, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { RevenueChart, DonutChart } from "@/components/charts";
import { TASK_STATUS, PRIORITY } from "@/lib/constants";
import { TodoWidget } from "./todo-widget";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const settings = await getSettings();
  const cur = settings.currency;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.toDateString());
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [openInvoices, paidThisMonth, leadsThisMonth, activeProjects, myTasks, openTickets, payments, expenses, leadStatuses, overdue, activities, todos] =
    await Promise.all([
      db.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] } }, include: { payments: true } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
      db.lead.count({ where: { createdAt: { gte: monthStart } } }),
      db.project.count({ where: { status: "IN_PROGRESS" } }),
      db.task.findMany({
        where: { status: { not: "COMPLETE" }, assignees: { some: { id: user.id } } },
        orderBy: [{ dueDate: "asc" }],
        take: 6,
        include: { project: { select: { name: true } } },
      }),
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.payment.findMany({ where: { date: { gte: yearAgo } }, select: { amount: true, date: true } }),
      db.expense.findMany({ where: { date: { gte: yearAgo } }, select: { amount: true, date: true } }),
      db.leadStatus.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: { where: { lost: false, junk: false } } } } } }),
      db.invoice.findMany({
        where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } },
        include: { customer: { select: { company: true } } },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { staff: { select: { firstName: true, lastName: true } } } }),
      db.todo.findMany({ where: { staffId: user.id }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 20 }),
    ]);

  const outstanding = openInvoices.reduce((s, i) => s + i.total - i.payments.reduce((a, p) => a + p.amount, 0), 0);
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString("en", { month: "short" }), revenue: 0, expenses: 0 };
  });
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  for (const p of payments) {
    const i = idx[`${p.date.getFullYear()}-${p.date.getMonth()}`];
    if (i !== undefined) months[i].revenue += p.amount;
  }
  for (const e of expenses) {
    const i = idx[`${e.date.getFullYear()}-${e.date.getMonth()}`];
    if (i !== undefined) months[i].expenses += e.amount;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {user.firstName} 👋</h1>
        <p className="mt-1 text-sm text-slate-500">Here's what's happening at {settings.company_name} today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can(user, "invoices") && <Stat label="Outstanding invoices" value={money(outstanding, cur)} sub={`${openInvoices.length} unpaid · ${overdue.length} overdue`} accent="red" href="/admin/invoices?status=UNPAID" />}
        {can(user, "payments") && <Stat label="Received this month" value={money(paidThisMonth._sum.amount ?? 0, cur)} sub={now.toLocaleString("en", { month: "long", year: "numeric" })} accent="green" href="/admin/payments" />}
        {can(user, "leads") && <Stat label="New leads this month" value={leadsThisMonth} sub="Across all sources" accent="blue" href="/admin/leads" />}
        {can(user, "projects") && <Stat label="Active projects" value={activeProjects} sub={`${openTickets} open support tickets`} accent="yellow" href="/admin/projects" />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {can(user, "payments") && (
          <Card title="Payments vs expenses — last 12 months" className="xl:col-span-2">
            <div className="p-4">
              <RevenueChart data={months.map(({ month, revenue, expenses }) => ({ month, revenue, expenses }))} />
            </div>
          </Card>
        )}
        {can(user, "leads") && (
          <Card title="Leads pipeline" actions={<Link href="/admin/leads?view=kanban" className="link text-xs">Open board</Link>}>
            <div className="p-5">
              <DonutChart data={leadStatuses.map((s) => ({ name: s.name, value: s._count.leads, color: s.color }))} />
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="My open tasks" actions={<Link href="/admin/tasks?mine=1" className="link text-xs">View all</Link>}>
          {myTasks.length === 0 ? (
            <EmptyState title="Nothing assigned to you" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {myTasks.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <Link href={`/admin/tasks/${t.id}`} className="text-sm font-medium text-slate-800 hover:text-primary">
                    {t.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge map={TASK_STATUS} value={t.status} />
                    <StatusBadge map={PRIORITY} value={t.priority} />
                    {t.project && <span>{t.project.name}</span>}
                    {t.dueDate && <span className={t.dueDate < today ? "font-semibold text-brand-red" : ""}>Due {fmtDate(t.dueDate)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {can(user, "invoices") && (
          <Card title="Overdue invoices" actions={<Link href="/admin/invoices?status=OVERDUE" className="link text-xs">View all</Link>}>
            {overdue.length === 0 ? (
              <EmptyState title="No overdue invoices 🎉" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {overdue.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/admin/invoices/${i.id}`} className="text-sm font-medium text-slate-800 hover:text-primary">
                        {i.prefix}
                        {String(i.number).padStart(6, "0")}
                      </Link>
                      <p className="text-xs text-slate-500">{i.customer.company}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{money(i.total, i.currency)}</p>
                      <Badge tone="red">Due {fmtDate(i.dueDate)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <TodoWidget todos={todos.map((t) => ({ id: t.id, text: t.text, done: t.done }))} />
      </div>

      <Card title="Latest activity">
        {activities.length === 0 ? (
          <EmptyState title="No activity yet" text="Actions across the CRM will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold">{a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "System"}</span> {a.description}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
