import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { HR_CODE } from "./org";

/* ── Who sees whose tasks and to-dos ────────────────────────────────────
   Super Admin, HR  → everyone's tasks and to-dos (they track all work).
   TL               → their own + the Executives in the departments they lead.
   Executive        → only their own (assigned to them or created by them).
   Staff who aren't in any department keep the old behaviour (all tasks), so
   nothing changes for existing role-based users.
   On top of that, anyone added to a task as a follow-up (watcher) can see it. */

export type TaskScope =
  | { kind: "all"; tracker: boolean } // tracker = Super Admin / HR (can open Team work)
  | { kind: "team"; teamIds: number[] } // TL: Executives they lead (not including themselves)
  | { kind: "self" };

export const getTaskScope = cache(async (user: CurrentUser): Promise<TaskScope> => {
  if (user.isAdmin || user.isHR) return { kind: "all", tracker: true };
  if (user.memberships.length === 0) return { kind: "all", tracker: false };
  const led = user.memberships.filter((m) => m.teamRole === "TL").map((m) => m.departmentId);
  if (!led.length) return { kind: "self" };
  const rows = await db.departmentMember.findMany({
    where: { departmentId: { in: led }, teamRole: "EXECUTIVE", staff: { active: true }, staffId: { not: user.id } },
    select: { staffId: true },
  });
  return { kind: "team", teamIds: [...new Set(rows.map((r) => r.staffId))] };
});

/** Super Admin, HR and TLs get the Team work page (tasks + to-dos of the people they track). */
export const canTrackTeam = (s: TaskScope) => (s.kind === "all" && s.tracker) || s.kind === "team";

/** People whose work this user can see: null = everyone. */
export function trackedIds(user: CurrentUser, s: TaskScope): number[] | null {
  if (s.kind === "all") return null;
  return s.kind === "team" ? [user.id, ...s.teamIds] : [user.id];
}

export async function visibleTaskWhere(user: CurrentUser): Promise<Prisma.TaskWhereInput> {
  const ids = trackedIds(user, await getTaskScope(user));
  if (!ids) return {};
  return {
    OR: [
      { assignees: { some: { id: { in: ids } } } },
      { createdById: { in: ids } },
      { watchers: { some: { id: user.id } } },
    ],
  };
}

export async function canSeeTask(user: CurrentUser, taskId: number) {
  return (await db.task.count({ where: { AND: [{ id: taskId }, await visibleTaskWhere(user)] } })) > 0;
}

/** Edit details, reassign, delete. Assignees who can't manage a task can still change its status and comment. */
export async function canManageTask(user: CurrentUser, task: { createdById: number | null }) {
  const s = await getTaskScope(user);
  if (s.kind === "all") return true;
  if (task.createdById === user.id) return true;
  return s.kind === "team" && task.createdById !== null && s.teamIds.includes(task.createdById);
}

const staffSelect = { id: true, firstName: true, lastName: true } as const;
export type PersonOption = { id: number; firstName: string; lastName: string };

/** Who this user may assign tasks to. Executives: only themselves. TLs: themselves + their Executives. */
export async function assignableStaff(user: CurrentUser): Promise<PersonOption[]> {
  const ids = trackedIds(user, await getTaskScope(user));
  return db.staff.findMany({ where: { active: true, ...(ids ? { id: { in: ids } } : {}) }, orderBy: { firstName: "asc" }, select: staffSelect });
}

/** Super Admins and HR people, who can be attached to a task as follow-up. */
export async function followUpStaff(): Promise<PersonOption[]> {
  return db.staff.findMany({
    where: { active: true, OR: [{ isAdmin: true }, { orgMemberships: { some: { department: { code: HR_CODE } } } }] },
    orderBy: { firstName: "asc" },
    select: staffSelect,
  });
}

/** Executives create tasks only for themselves, so they don't pick follow-ups either. */
export const canAttachFollowUp = (s: TaskScope) => s.kind !== "self";
