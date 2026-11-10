import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";

export const AUDIENCES = ["ALL", "DEPARTMENTS", "PEOPLE"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Not expired. Announcements without an expiry date never expire. */
export const liveWhere = (): Prisma.AnnouncementWhereInput => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

/** Departments that count as "mine" for targeting: my departments plus their parents
 *  (so an announcement to "Paid Advertising" reaches people in SMM and SEM). */
const myDepartmentIds = (u: CurrentUser) => [...new Set(u.memberships.flatMap((m) => (m.parentId ? [m.departmentId, m.parentId] : [m.departmentId])))];

/** Live announcements this user is a recipient of. */
export function visibleWhere(u: CurrentUser): Prisma.AnnouncementWhereInput {
  const deptIds = myDepartmentIds(u);
  return {
    AND: [
      liveWhere(),
      {
        OR: [
          { audience: "ALL" },
          { createdById: u.id },
          ...(deptIds.length ? [{ audience: "DEPARTMENTS", departments: { some: { id: { in: deptIds } } } }] : []),
          { audience: "PEOPLE", recipients: { some: { id: u.id } } },
        ],
      },
    ],
  };
}

export const unreadWhere = (u: CurrentUser): Prisma.AnnouncementWhereInput => ({
  AND: [visibleWhere(u), { reads: { none: { staffId: u.id } } }],
});

const listInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
  departments: { select: { id: true, name: true } },
  recipients: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AnnouncementInclude;

/** Pinned first, then urgent, then newest. */
export const announcementOrder: Prisma.AnnouncementOrderByWithRelationInput[] = [{ pinned: "desc" }, { urgent: "desc" }, { createdAt: "desc" }];

/** For the bell and the banner. */
export async function inboxFor(u: CurrentUser, take = 8) {
  const [items, unread] = await Promise.all([
    db.announcement.findMany({
      where: visibleWhere(u),
      orderBy: announcementOrder,
      take,
      include: { ...listInclude, reads: { where: { staffId: u.id }, select: { readAt: true } } },
    }),
    db.announcement.count({ where: unreadWhere(u) }),
  ]);
  return { items: items.map(({ reads, ...a }) => ({ ...a, read: reads.length > 0 })), unread };
}

export async function listFor(u: CurrentUser) {
  const items = await db.announcement.findMany({
    // Super Admins see every announcement, expired ones included. HR also sees
    // the ones they sent, expired included. Everyone else: what's addressed to them.
    where: u.isAdmin ? {} : u.isHR ? { OR: [visibleWhere(u), { createdById: u.id }] } : visibleWhere(u),
    orderBy: announcementOrder,
    include: { ...listInclude, reads: { select: { staffId: true } } },
  });
  return items.map(({ reads, ...a }) => {
    /** The viewer sent it (or is a Super Admin): show receipts and management links. */
    const mine = u.isAdmin || a.createdById === u.id;
    // Only the sender sees who else read it.
    return { ...a, mine, reads: mine ? reads : [], read: reads.some((r) => r.staffId === u.id) };
  });
}

type Target = { audience: string; createdById: number | null; departments: { id: number }[]; recipients: { id: number }[] };

/** Active staff with the department ids that count for targeting (their departments + parents). Load once per page. */
export async function staffDirectory() {
  const staff = await db.staff.findMany({
    where: { active: true },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      lastLogin: true,
      orgMemberships: { select: { teamRole: true, department: { select: { id: true, name: true, parentId: true } } } },
    },
  });
  return staff.map(({ orgMemberships, ...s }) => ({
    ...s,
    name: `${s.firstName} ${s.lastName}`.trim(),
    deptIds: orgMemberships.flatMap((m) => (m.department.parentId ? [m.department.id, m.department.parentId] : [m.department.id])),
    placement: orgMemberships[0] ? `${orgMemberships[0].department.name} · ${orgMemberships[0].teamRole === "TL" ? "TL" : "Executive"}` : s.isAdmin ? "Super Admin" : "No department",
  }));
}
export type DirectoryPerson = Awaited<ReturnType<typeof staffDirectory>>[number];

/** Active staff an announcement is meant for (its author excluded). Used for read receipts. */
export function resolveAudience(a: Target, dir: DirectoryPerson[]) {
  const deptIds = new Set(a.departments.map((d) => d.id));
  const people = new Set(a.recipients.map((r) => r.id));
  return dir.filter((s) => {
    if (s.id === a.createdById) return false;
    if (a.audience === "ALL") return true;
    if (a.audience === "PEOPLE") return people.has(s.id);
    return s.deptIds.some((id) => deptIds.has(id));
  });
}

/** How many of the intended people have read it. */
export function readStats(a: Target & { reads: { staffId: number }[] }, dir: DirectoryPerson[]) {
  const audience = resolveAudience(a, dir);
  const readIds = new Set(a.reads.map((r) => r.staffId));
  const read = audience.filter((s) => readIds.has(s.id)).length;
  return { total: audience.length, read, pct: audience.length ? Math.round((read / audience.length) * 100) : 0 };
}

/** "Everyone", "SEO, SMM" or "Rahul S, Priya K +2" */
export function audienceLabel(a: { audience: string; departments: { name: string }[]; recipients: { firstName: string; lastName: string }[] }) {
  if (a.audience === "ALL") return "Everyone";
  const names = a.audience === "DEPARTMENTS" ? a.departments.map((d) => d.name) : a.recipients.map((r) => `${r.firstName} ${r.lastName}`.trim());
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ") || "Nobody";
}

/** Departments (as a tree) and active people for the compose form. */
export async function composeOptions() {
  const [departments, staff] = await Promise.all([
    db.orgDepartment.findMany({
      where: { active: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, children: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } },
    }),
    db.staff.findMany({
      where: { active: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, isAdmin: true, role: { select: { name: true } }, orgMemberships: { select: { teamRole: true, department: { select: { name: true } } } } },
    }),
  ]);
  return {
    departments,
    staff: staff.map((s) => {
      const m = s.orgMemberships[0];
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        sub: s.isAdmin ? "Super Admin" : m ? `${m.department.name} · ${m.teamRole === "TL" ? "TL" : "Executive"}` : s.role?.name ?? "Staff",
      };
    }),
  };
}
