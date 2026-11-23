import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Circle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, timeAgo } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { teamRoleLabel } from "@/lib/org";
import { canTrackTeam, getTaskScope, trackedIds } from "@/lib/task-access";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { FilterSelect } from "@/components/client";

export const metadata = { title: "Team work" };
const DAY = 86_400_000;

/** Super Admin / HR: everyone's tasks and to-dos. TL: their own and their Executives'. Executives can't open this. */
export default async function TeamWorkPage({ searchParams }: { searchParams: Promise<{ person?: string; dept?: string }> }) {
  const user = await requireUser();
  const scope = await getTaskScope(user);
  if (!canTrackTeam(scope)) redirect("/admin/forbidden");
  const sp = await searchParams;
  const ids = trackedIds(user, scope);
  const deptId = sp.dept ? Number(sp.dept) : null;
  const now = new Date();
  const today = new Date(now.toDateString());
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const [staff, depts] = await Promise.all([
    db.staff.findMany({
      where: {
        active: true,
        ...(ids ? { id: { in: ids } } : {}),
        ...(deptId ? { orgMemberships: { some: { OR: [{ departmentId: deptId }, { department: { parentId: deptId } }] } } } : {}),
      },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, lastLogin: true, isAdmin: true, orgMemberships: { select: { teamRole: true, department: { select: { name: true } } } } },
    }),
    ids ? [] : db.orgDepartment.findMany({ where: { active: true, parentId: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const staffIds = staff.map((s) => s.id);
  const [openTasks, doneTasks, todos] = await Promise.all([
    db.task.findMany({ where: { status: { not: "COMPLETE" }, assignees: { some: { id: { in: staffIds } } } }, select: { dueDate: true, assignees: { select: { id: true } } } }),
    db.task.findMany({ where: { status: "COMPLETE", completedAt: { gte: weekAgo }, assignees: { some: { id: { in: staffIds } } } }, select: { assignees: { select: { id: true } } } }),
    db.todo.groupBy({ by: ["staffId", "done"], where: { staffId: { in: staffIds } }, _count: { _all: true } }),
  ]);
  const has = (t: { assignees: { id: number }[] }, id: number) => t.assignees.some((a) => a.id === id);
  const stats = (id: number) => {
    const open = openTasks.filter((t) => has(t, id));
    const count = (done: boolean) => todos.find((r) => r.staffId === id && r.done === done)?._count._all ?? 0;
    return { open: open.length, overdue: open.filter((t) => t.dueDate && t.dueDate < today).length, done: doneTasks.filter((t) => has(t, id)).length, todoOpen: count(false), todoDone: count(true) };
  };

  const personId = sp.person ? Number(sp.person) : null;
  const person = staff.find((s) => s.id === personId) ?? null;
  const href = (p: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ dept: sp.dept ?? null, ...p })) if (v !== null && v !== "") q.set(k, String(v));
    return `?${q}`;
  };
  const roleOf = (s: (typeof staff)[number]) =>
    s.isAdmin ? "Super Admin" : s.orgMemberships.map((m) => `${m.department.name} · ${teamRoleLabel(m.teamRole)}`).join(", ") || "No department";

  return (
    <>
      <PageHeader
        title="Team work"
        subtitle={scope.kind === "team" ? "Tasks and to-do lists of you and your Executives." : "Tasks and to-do lists of everyone in the company."}
        actions={<ButtonLink href="/admin/tasks/new">+ New task</ButtonLink>}
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          {depts.length > 0 && (
            <div className="border-b border-slate-100 p-4">
              <FilterSelect name="dept" placeholder="All departments" options={depts.map((d) => ({ value: String(d.id), label: d.name }))} />
            </div>
          )}
          {staff.length === 0 ? (
            <EmptyState title="No one to show" text={scope.kind === "team" ? "No Executives are in your team yet. HR places people in departments." : "No active staff in this department."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="th">Person</th>
                    <th className="th text-right">Open tasks</th>
                    <th className="th text-right">Overdue</th>
                    <th className="th text-right">Done 7d</th>
                    <th className="th text-right">To-dos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((s) => {
                    const p = stats(s.id);
                    const name = `${s.firstName} ${s.lastName}`.trim();
                    return (
                      <tr key={s.id} className={clsx("hover:bg-slate-50/60", person?.id === s.id && "bg-blue-50/60")}>
                        <td className="td">
                          <Link href={href({ person: s.id })} scroll={false} className="flex items-center gap-3">
                            <Avatar name={name} size={30} />
                            <span>
                              <span className="block font-medium text-slate-800 hover:text-primary">{name}{s.id === user.id && <span className="text-slate-400"> (you)</span>}</span>
                              <span className="block text-xs text-slate-400">{roleOf(s)}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="td text-right font-medium">{p.open}</td>
                        <td className={clsx("td text-right font-medium", p.overdue && "text-brand-red")}>{p.overdue}</td>
                        <td className={clsx("td text-right font-medium", p.done && "text-brand-green")}>{p.done}</td>
                        <td className="td text-right text-sm text-slate-600">{p.todoOpen} open · {p.todoDone} done</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6 xl:col-span-2">
          {person ? <PersonWork person={person} today={today} lastLogin={person.lastLogin} /> : (
            <Card><EmptyState title="Pick a person" text="Click someone on the left to see their open tasks and to-do list." /></Card>
          )}
        </div>
      </div>
    </>
  );
}

async function PersonWork({ person, today, lastLogin }: { person: { id: number; firstName: string; lastName: string }; today: Date; lastLogin: Date | null }) {
  const monthAgo = new Date(today.getTime() - 30 * DAY);
  const [tasks, todos] = await Promise.all([
    db.task.findMany({
      where: { assignees: { some: { id: person.id } }, OR: [{ status: { not: "COMPLETE" } }, { completedAt: { gte: monthAgo } }] },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 40,
      select: { id: true, name: true, status: true, priority: true, dueDate: true, completedAt: true, createdBy: { select: { firstName: true } } },
    }),
    db.todo.findMany({ where: { staffId: person.id }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 50 }),
  ]);
  const open = tasks.filter((t) => t.status !== "COMPLETE");
  const done = tasks.filter((t) => t.status === "COMPLETE");
  const name = `${person.firstName} ${person.lastName}`.trim();

  return (
    <>
      <Card
        title={`${name} · tasks`}
        actions={<Link href={`/admin/tasks?person=${person.id}&all=1`} className="link text-xs">Open in Tasks</Link>}
      >
        <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-400">Last seen {lastLogin ? timeAgo(lastLogin) : "never"}</p>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks" text="Nothing open, and nothing finished in the last 30 days." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...open, ...done].map((t) => (
              <li key={t.id} className="px-5 py-3">
                <Link href={`/admin/tasks/${t.id}`} className={clsx("text-sm font-medium hover:text-primary", t.status === "COMPLETE" ? "text-slate-400 line-through" : "text-slate-800")}>{t.name}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <StatusBadge map={TASK_STATUS} value={t.status} />
                  <StatusBadge map={PRIORITY} value={t.priority} />
                  {t.status === "COMPLETE" && t.completedAt ? <span>Done {fmtDate(t.completedAt)}</span> : t.dueDate && <span className={t.dueDate < today ? "font-semibold text-brand-red" : ""}>Due {fmtDate(t.dueDate)}</span>}
                  {t.createdBy && <span>· from {t.createdBy.firstName}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`${name} · to-do list`} actions={<Badge>{todos.filter((t) => !t.done).length} open</Badge>}>
        {todos.length === 0 ? (
          <EmptyState title="Empty to-do list" />
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {todos.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-2.5">
                {t.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                <span className={clsx("flex-1 text-sm", t.done ? "text-slate-400 line-through" : "text-slate-700")}>{t.text}</span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(t.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
