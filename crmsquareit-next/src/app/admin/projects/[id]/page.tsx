import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, formatDuration, money } from "@/lib/format";
import { docNumber, isOverdue } from "@/lib/sales";
import { INVOICE_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS } from "@/lib/constants";
import { Avatar, ButtonLink, Card, DetailRow, EmptyState, PageHeader, Stat, StatusBadge, Table, Tabs } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { Notes } from "@/components/notes";
import { deleteProject } from "../actions";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePerm("projects");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const p = await db.project.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      members: true,
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { assignees: true, timeEntries: true } },
      invoices: { include: { payments: true } },
      expenses: { include: { category: true } },
    },
  });
  if (!p) notFound();
  const done = p.tasks.filter((t) => t.status === "COMPLETE").length;
  const ms = p.tasks.flatMap((t) => t.timeEntries).reduce((s, e) => s + ((e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
  const billed = p.invoices.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.total, 0);
  const spent = p.expenses.reduce((s, e) => s + e.amount, 0);
  const daysLeft = p.deadline ? Math.ceil((p.deadline.getTime() - Date.now()) / 86400000) : null;
  const base = `/admin/projects/${p.id}`;
  const cur = p.customer.currency || "INR";

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={<Link className="link" href={`/admin/customers/${p.customerId}`}>{p.customer.company}</Link>}
        back={{ href: "/admin/projects", label: "Projects" }}
        actions={
          <>
            <StatusBadge map={PROJECT_STATUS} value={p.status} />
            {can(user, "tasks", "create") && <ButtonLink variant="secondary" href={`/admin/tasks/new?projectId=${p.id}`}>+ Task</ButtonLink>}
            {can(user, "invoices", "create") && <ButtonLink variant="secondary" href={`/admin/invoices/new?customerId=${p.customerId}&projectId=${p.id}`}>Invoice project</ButtonLink>}
            {can(user, "projects", "edit") && <ButtonLink variant="secondary" href={`${base}/edit`}>Edit</ButtonLink>}
            {can(user, "projects", "delete") && <ConfirmButton action={deleteProject} hidden={{ id: p.id }} />}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Progress" value={`${p.progress}%`} sub={<span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-brand-green" style={{ width: `${p.progress}%` }} /></span>} accent="green" />
        <Stat label="Tasks" value={`${done} / ${p.tasks.length}`} sub="completed" accent="blue" />
        <Stat label="Time logged" value={formatDuration(ms)} sub={p.billingType === "HOURLY" ? `≈ ${money((ms / 3600000) * p.rate, cur)} billable` : "Fixed price"} accent="yellow" />
        <Stat label="Deadline" value={p.deadline ? fmtDate(p.deadline) : "—"} sub={daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days overdue`) : undefined} accent="red" />
      </div>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "tasks", label: "Tasks", count: p.tasks.length },
          { key: "finance", label: "Invoices & expenses", count: p.invoices.length + p.expenses.length },
          { key: "notes", label: "Notes" },
        ]}
      />
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Project details" className="lg:col-span-2">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Customer">{p.customer.company}</DetailRow>
              <DetailRow label="Billing">{p.billingType === "FIXED" ? `Fixed · ${money(p.rate, cur)}` : `Hourly · ${money(p.rate, cur)}/h`}</DetailRow>
              <DetailRow label="Start date">{fmtDate(p.startDate)}</DetailRow>
              <DetailRow label="Deadline">{fmtDate(p.deadline)}</DetailRow>
              <DetailRow label="Invoiced">{money(billed, cur)}</DetailRow>
              <DetailRow label="Expenses">{money(spent, cur)}</DetailRow>
            </dl>
            {p.description && <p className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{p.description}</p>}
          </Card>
          <Card title={`Members (${p.members.length})`}>
            <ul className="divide-y divide-slate-100">
              {p.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm"><Avatar name={`${m.firstName} ${m.lastName}`} /> {m.firstName} {m.lastName}</li>
              ))}
              {p.members.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No members assigned.</li>}
            </ul>
          </Card>
        </div>
      )}
      {tab === "tasks" && (
        <Card actions={<Link className="link text-xs" href={`/admin/tasks?view=kanban&project=${p.id}`}>Kanban view</Link>} title="Tasks">
          {p.tasks.length === 0 ? (
            <EmptyState title="No tasks yet" action={<ButtonLink href={`/admin/tasks/new?projectId=${p.id}`}>Add task</ButtonLink>} />
          ) : (
            <Table head={["Task", "Assignees", "Priority", "Due", "Status"]}>
              {p.tasks.map((t) => (
                <tr key={t.id}>
                  <td className="td"><Link className="link" href={`/admin/tasks/${t.id}`}>{t.name}</Link></td>
                  <td className="td"><div className="flex -space-x-2">{t.assignees.map((a) => <Avatar key={a.id} name={`${a.firstName} ${a.lastName}`} size={24} />)}</div></td>
                  <td className="td"><StatusBadge map={PRIORITY} value={t.priority} /></td>
                  <td className="td">{fmtDate(t.dueDate)}</td>
                  <td className="td"><StatusBadge map={TASK_STATUS} value={t.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      {tab === "finance" && (
        <div className="space-y-6">
          <Card title="Invoices">
            {p.invoices.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">No invoices linked.</p> : (
              <Table head={["Invoice", "Date", "Total", "Status"]}>
                {p.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td"><Link className="link" href={`/admin/invoices/${i.id}`}>{docNumber(i.prefix, i.number)}</Link></td>
                    <td className="td">{fmtDate(i.date)}</td>
                    <td className="td">{money(i.total, i.currency)}</td>
                    <td className="td"><StatusBadge map={INVOICE_STATUS} value={isOverdue(i) ? "OVERDUE" : i.status} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Expenses">
            {p.expenses.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">No expenses linked.</p> : (
              <Table head={["Expense", "Category", "Date", "Amount"]}>
                {p.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="td"><Link className="link" href={`/admin/expenses/${e.id}`}>{e.name}</Link></td>
                    <td className="td">{e.category.name}</td>
                    <td className="td">{fmtDate(e.date)}</td>
                    <td className="td">{money(e.amount, cur)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}
      {tab === "notes" && <Notes relType="project" relId={p.id} path={base} />}
    </>
  );
}
