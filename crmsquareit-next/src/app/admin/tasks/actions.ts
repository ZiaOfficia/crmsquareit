"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm, type CurrentUser } from "@/lib/auth";
import { assignableStaff, canAttachFollowUp, canManageTask, canSeeTask, followUpStaff, getTaskScope } from "@/lib/task-access";
import { logActivity } from "@/lib/activity";
import { str, reqStr, intOrNull, dateOrNull, ints, bool, type ActionState } from "@/lib/forms";

function data(f: FormData) {
  return {
    name: reqStr(f, "name"),
    description: str(f, "description"),
    priority: reqStr(f, "priority") || "MEDIUM",
    status: reqStr(f, "status") || "NOT_STARTED",
    startDate: dateOrNull(f, "startDate") ?? new Date(),
    dueDate: dateOrNull(f, "dueDate"),
    projectId: intOrNull(f, "projectId"),
    customerId: intOrNull(f, "customerId"),
    billable: bool(f, "billable"),
  };
}

async function syncProjectProgress(projectId: number | null) {
  if (!projectId) return;
  const tasks = await db.task.findMany({ where: { projectId }, select: { status: true } });
  if (!tasks.length) return;
  const progress = Math.round((tasks.filter((t) => t.status === "COMPLETE").length / tasks.length) * 100);
  await db.project.update({ where: { id: projectId }, data: { progress } });
}

/** Only lets through people this user may pick; people already on the task stay allowed. */
const pick = (wanted: number[], allowed: { id: number }[], existing: { id: number }[] = []) => {
  const ok = new Set([...allowed, ...existing].map((s) => s.id));
  return [...new Set(wanted)].filter((x) => ok.has(x)).map((x) => ({ id: x }));
};

export async function saveTask(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("tasks", id ? "edit" : "create");
  const existing = id ? await db.task.findUnique({ where: { id }, include: { assignees: { select: { id: true } }, watchers: { select: { id: true } } } }) : null;
  if (id && (!existing || !(await canManageTask(user, existing)))) return { error: "You can't edit this task." };
  const d = data(f);
  if (!d.name) return { error: "Task name is required." };
  if (d.projectId && !d.customerId) d.customerId = (await db.project.findUnique({ where: { id: d.projectId } }))?.customerId ?? null;
  const scope = await getTaskScope(user);
  // Executives work on their own tasks only; TLs assign to themselves or their Executives.
  const assignees = scope.kind === "self" ? [{ id: user.id }] : pick(ints(f, "assignees"), await assignableStaff(user), existing?.assignees);
  const watchers = canAttachFollowUp(scope)
    ? pick(ints(f, "watchers"), await followUpStaff(), existing?.watchers)
    : (existing?.watchers ?? []).map((w) => ({ id: w.id }));
  const completedAt = d.status === "COMPLETE" ? new Date() : null;
  const t = id
    ? await db.task.update({ where: { id }, data: { ...d, completedAt, assignees: { set: assignees }, watchers: { set: watchers } } })
    : await db.task.create({ data: { ...d, completedAt, createdById: user.id, assignees: { connect: assignees }, watchers: { connect: watchers } } });
  await syncProjectProgress(t.projectId);
  await logActivity("task", t.id, `${id ? "updated" : "created"} task ${t.name}`, user.id);
  redirect(`/admin/tasks/${t.id}`);
}

/** The task's managers and the people it's assigned to can move it. */
async function canMoveTask(user: CurrentUser, id: number) {
  const t = await db.task.findUnique({ where: { id }, select: { createdById: true, assignees: { select: { id: true } } } });
  if (!t || !(await canSeeTask(user, id))) return false;
  return t.assignees.some((a) => a.id === user.id) || (await canManageTask(user, t));
}

export async function setTaskStatus(id: number, status: string) {
  const user = await requirePerm("tasks", "edit");
  if (!(await canMoveTask(user, id))) return;
  const t = await db.task.update({ where: { id }, data: { status, completedAt: status === "COMPLETE" ? new Date() : null } });
  await syncProjectProgress(t.projectId);
  await logActivity("task", id, `moved task ${t.name} to ${status.replace(/_/g, " ").toLowerCase()}`, user.id);
  revalidatePath("/admin/tasks");
  revalidatePath(`/admin/tasks/${id}`);
}

export async function setTaskStatusForm(f: FormData) {
  await setTaskStatus(Number(f.get("id")), String(f.get("status")));
}

export async function addComment(taskId: number, _: unknown, f: FormData) {
  const user = await requirePerm("tasks");
  const content = reqStr(f, "content");
  if (!(await canSeeTask(user, taskId))) return { ok: false };
  if (content) await db.taskComment.create({ data: { taskId, staffId: user.id, content } });
  revalidatePath(`/admin/tasks/${taskId}`);
  return { ok: true };
}

export async function toggleTimer(f: FormData) {
  const user = await requirePerm("tasks");
  const taskId = Number(f.get("taskId"));
  if (!(await canSeeTask(user, taskId))) return;
  const running = await db.timeEntry.findFirst({ where: { staffId: user.id, endTime: null } });
  if (running) await db.timeEntry.update({ where: { id: running.id }, data: { endTime: new Date() } });
  if (!running || running.taskId !== taskId) await db.timeEntry.create({ data: { taskId, staffId: user.id, startTime: new Date() } });
  revalidatePath(`/admin/tasks/${taskId}`);
  if (running && running.taskId !== taskId) revalidatePath(`/admin/tasks/${running.taskId}`);
}

export async function deleteTimeEntry(f: FormData) {
  const user = await requirePerm("tasks", "edit");
  const id = Number(f.get("id"));
  const e = await db.timeEntry.findUnique({ where: { id } });
  if (e && (user.isAdmin || e.staffId === user.id)) await db.timeEntry.delete({ where: { id } });
  if (e) revalidatePath(`/admin/tasks/${e.taskId}`);
}

export async function deleteTask(f: FormData) {
  const user = await requirePerm("tasks", "delete");
  const id = Number(f.get("id"));
  const found = await db.task.findUnique({ where: { id }, select: { createdById: true } });
  if (!found || !(await canManageTask(user, found))) redirect("/admin/forbidden");
  const t = await db.task.delete({ where: { id } });
  await syncProjectProgress(t.projectId);
  await logActivity("task", id, `deleted task ${t.name}`, user.id);
  redirect(t.projectId ? `/admin/projects/${t.projectId}?tab=tasks` : "/admin/tasks");
}
