import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { Avatar, ButtonLink, Card, EmptyState, PageHeader, StatusBadge, Table, btn, cx } from "@/components/ui";
import { FilterSelect, SearchBox } from "@/components/client";
import { Pagination, pageArgs } from "@/components/pagination";
import { Kanban } from "@/components/kanban";
import { setTaskStatus } from "./actions";

export const metadata = { title: "Tasks" };
const COLORS: Record<string, string> = { NOT_STARTED: "#94a3b8", IN_PROGRESS: "#4f74c4", TESTING: "#7c5cc4", AWAITING_FEEDBACK: "#e0a400", COMPLETE: "#27ae57" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("tasks");
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const where: Prisma.TaskWhereInput = {};
  if (sp.mine === "1") where.assignees = { some: { id: user.id } };
  if (sp.status) where.status = sp.status;
  else if (view === "list" && sp.all !== "1") where.status = { not: "COMPLETE" };
  if (sp.priority) where.priority = sp.priority;
  if (sp.project) where.projectId = Number(sp.project);
  if (sp.q) where.name = { contains: sp.q };
  const projects = await db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const today = new Date(new Date().toDateString());

  const toggle = (key: string, val: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
    if (p.get(key) === val) p.delete(key);
    else p.set(key, val);
    return `?${p}`;
  };
  const viewHref = (v: string | null) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, x]) => x && k !== "page" && k !== "view" && k !== "status") as [string, string][]);
    if (v) p.set("view", v);
    return `?${p}`;
  };
  const header = (
    <PageHeader
      title="Tasks"
      actions={
        <>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            <Link href={viewHref(null)} className={cx("rounded-md px-3 py-1.5 text-sm", view === "list" ? "bg-slate-100 font-medium" : "text-slate-500")}>List</Link>
            <Link href={viewHref("kanban")} className={cx("rounded-md px-3 py-1.5 text-sm", view === "kanban" ? "bg-slate-100 font-medium" : "text-slate-500")}>Kanban</Link>
          </div>
          <ButtonLink href={`/admin/tasks/new${sp.project ? `?projectId=${sp.project}` : ""}`}>+ New task</ButtonLink>
        </>
      }
    />
  );
  const filters = (
    <div className="flex flex-wrap gap-2">
      <SearchBox placeholder="Search tasks…" />
      <FilterSelect name="project" placeholder="All projects" options={projects.map((p) => ({ value: String(p.id), label: p.name }))} />
      <FilterSelect name="priority" placeholder="Any priority" options={Object.entries(PRIORITY).map(([value, s]) => ({ value, label: s.label }))} />
      {view === "list" && <FilterSelect name="status" placeholder="Open tasks" options={Object.entries(TASK_STATUS).map(([value, s]) => ({ value, label: s.label }))} />}
      <Link href={toggle("mine", "1")} className={btn(sp.mine === "1" ? "primary" : "secondary")}>My tasks</Link>
    </div>
  );

  if (view === "kanban") {
    const tasks = await db.task.findMany({ where, orderBy: [{ dueDate: "asc" }], include: { project: { select: { name: true } }, assignees: true } });
    return (
      <>
        {header}
        <div className="mb-4">{filters}</div>
        <Kanban
          columns={Object.entries(TASK_STATUS).map(([id, s]) => ({ id, name: s.label, color: COLORS[id] }))}
          cards={tasks.map((t) => ({
            id: t.id,
            columnId: t.status,
            title: t.name,
            subtitle: t.project?.name,
            meta: [PRIORITY[t.priority]?.label, t.dueDate ? `Due ${fmtDate(t.dueDate)}` : null, t.assignees.map((a) => a.firstName).join(", ")].filter(Boolean).join(" · "),
            href: `/admin/tasks/${t.id}`,
            accent: { LOW: "#94a3b8", MEDIUM: "#4f74c4", HIGH: "#e0a400", URGENT: "#e84a37" }[t.priority],
          }))}
          onMove={setTaskStatus}
        />
      </>
    );
  }

  const { page, skip, take } = pageArgs(sp.page);
  const [rows, total] = await Promise.all([
    db.task.findMany({ where, skip, take, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], include: { project: { select: { id: true, name: true } }, assignees: true } }),
    db.task.count({ where }),
  ]);
  return (
    <>
      {header}
      <Card>
        <div className="border-b border-slate-100 p-4">{filters}</div>
        {rows.length === 0 ? (
          <EmptyState title="No tasks found" action={<ButtonLink href="/admin/tasks/new">Add task</ButtonLink>} />
        ) : (
          <Table head={["Task", "Project", "Assignees", "Priority", "Start", "Due", "Status"]}>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/60">
                <td className="td"><Link className="link" href={`/admin/tasks/${t.id}`}>{t.name}</Link></td>
                <td className="td">{t.project ? <Link className="hover:text-primary" href={`/admin/projects/${t.project.id}`}>{t.project.name}</Link> : "—"}</td>
                <td className="td"><div className="flex -space-x-2">{t.assignees.map((a) => <Avatar key={a.id} name={`${a.firstName} ${a.lastName}`} size={24} />)}</div></td>
                <td className="td"><StatusBadge map={PRIORITY} value={t.priority} /></td>
                <td className="td">{fmtDate(t.startDate)}</td>
                <td className={cx("td", t.dueDate && t.dueDate < today && t.status !== "COMPLETE" && "font-semibold text-brand-red")}>{fmtDate(t.dueDate)}</td>
                <td className="td"><StatusBadge map={TASK_STATUS} value={t.status} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination total={total} page={page} params={sp} />
      </Card>
    </>
  );
}
