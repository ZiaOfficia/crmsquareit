import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, formatDuration, timeAgo } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { Avatar, ButtonLink, Card, DetailRow, PageHeader, StatusBadge, btn, cx } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/client";
import { addComment, deleteTask, deleteTimeEntry, setTaskStatusForm, toggleTimer } from "../actions";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("tasks");
  const { id } = await params;
  const t = await db.task.findUnique({
    where: { id: Number(id) },
    include: {
      project: true,
      customer: true,
      assignees: true,
      createdBy: true,
      comments: { orderBy: { createdAt: "asc" }, include: { staff: true } },
      timeEntries: { orderBy: { startTime: "desc" }, include: { staff: true } },
    },
  });
  if (!t) notFound();
  const canEdit = can(user, "tasks", "edit");
  const myRunning = t.timeEntries.find((e) => !e.endTime && e.staffId === user.id);
  const totalMs = t.timeEntries.reduce((s, e) => s + ((e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);

  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={t.project ? <>Project: <Link className="link" href={`/admin/projects/${t.project.id}`}>{t.project.name}</Link></> : t.customer?.company}
        back={{ href: t.project ? `/admin/projects/${t.project.id}?tab=tasks` : "/admin/tasks", label: t.project ? t.project.name : "Tasks" }}
        actions={
          <>
            <form action={toggleTimer}>
              <input type="hidden" name="taskId" value={t.id} />
              <button className={btn(myRunning ? "danger" : "success")}>{myRunning ? "■ Stop timer" : "▶ Start timer"}</button>
            </form>
            {canEdit && <ButtonLink variant="secondary" href={`/admin/tasks/${t.id}/edit`}>Edit</ButtonLink>}
            {can(user, "tasks", "delete") && <ConfirmButton action={deleteTask} hidden={{ id: t.id }} />}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-wrap p-5 text-sm text-slate-700">{t.description || <span className="text-slate-400">No description.</span>}</p>
          </Card>
          {canEdit && (
            <Card title="Status">
              <div className="flex flex-wrap gap-2 p-4">
                {Object.entries(TASK_STATUS).map(([k, v]) => (
                  <form key={k} action={setTaskStatusForm}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={k} />
                    <button className={cx(btn(t.status === k ? "primary" : "secondary"), "text-xs")}>{v.label}</button>
                  </form>
                ))}
              </div>
            </Card>
          )}
          <Card title={`Comments (${t.comments.length})`}>
            <ul className="divide-y divide-slate-100">
              {t.comments.map((c) => (
                <li key={c.id} className="flex gap-3 px-5 py-4">
                  <Avatar name={c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : "?"} size={30} />
                  <div>
                    <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{c.staff?.firstName} {c.staff?.lastName}</span> · {timeAgo(c.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ActionForm action={addComment.bind(null, t.id)} resetOnSuccess className="space-y-2 border-t border-slate-100 p-4">
              <textarea name="content" rows={3} required placeholder="Add a comment…" className="input" />
              <div className="flex justify-end"><SubmitButton>Comment</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <dl className="divide-y divide-slate-100 px-5">
              <DetailRow label="Status"><StatusBadge map={TASK_STATUS} value={t.status} /></DetailRow>
              <DetailRow label="Priority"><StatusBadge map={PRIORITY} value={t.priority} /></DetailRow>
              <DetailRow label="Start date">{fmtDate(t.startDate)}</DetailRow>
              <DetailRow label="Due date">{fmtDate(t.dueDate)}</DetailRow>
              <DetailRow label="Billable">{t.billable ? "Yes" : "No"}</DetailRow>
              <DetailRow label="Created by">{t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : null}</DetailRow>
              {t.completedAt && <DetailRow label="Completed">{fmtDateTime(t.completedAt)}</DetailRow>}
            </dl>
          </Card>
          <Card title="Assignees">
            <ul className="divide-y divide-slate-100">
              {t.assignees.map((a) => <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm"><Avatar name={`${a.firstName} ${a.lastName}`} size={28} /> {a.firstName} {a.lastName}</li>)}
              {t.assignees.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">Nobody assigned.</li>}
            </ul>
          </Card>
          <Card title={`Timesheet · ${formatDuration(totalMs)}`}>
            <ul className="divide-y divide-slate-100">
              {t.timeEntries.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No time logged yet.</li>}
              {t.timeEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{e.staff.firstName} · {e.endTime ? formatDuration(e.endTime.getTime() - e.startTime.getTime()) : <span className="text-brand-green">running…</span>}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(e.startTime)}</p>
                  </div>
                  {(user.isAdmin || e.staffId === user.id) && <ConfirmButton action={deleteTimeEntry} hidden={{ id: e.id }} label="✕" confirmLabel="Delete?" variant="ghost" className="px-2 py-1 text-xs" />}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
