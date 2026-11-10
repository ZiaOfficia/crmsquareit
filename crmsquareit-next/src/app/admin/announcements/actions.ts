"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminOrHR, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { bool, dateOrNull, ints, str, type ActionState } from "@/lib/forms";
import { AUDIENCES, type Audience, unreadWhere, visibleWhere } from "@/lib/announcements";

function refresh() {
  revalidatePath("/admin", "layout");
}

/** Super Admin can manage any announcement; HR only the ones they sent. */
async function requireManageable(id: number) {
  const user = await requireAdminOrHR();
  const a = await db.announcement.findUnique({ where: { id }, select: { createdById: true } });
  if (!a || (!user.isAdmin && a.createdById !== user.id)) redirect("/admin/forbidden");
  return user;
}

async function parse(f: FormData) {
  const title = str(f, "title");
  const message = str(f, "message");
  const audience = str(f, "audience") as Audience | null;
  if (!title) return { error: "Add a title." } as const;
  if (title.length > 160) return { error: "Keep the title under 160 characters." } as const;
  if (!message) return { error: "Write a message." } as const;
  if (!audience || !AUDIENCES.includes(audience)) return { error: "Choose who should receive it." } as const;

  let departmentIds: number[] = [];
  let staffIds: number[] = [];
  if (audience === "DEPARTMENTS") {
    departmentIds = (await db.orgDepartment.findMany({ where: { id: { in: ints(f, "departmentIds") }, active: true }, select: { id: true } })).map((d) => d.id);
    if (!departmentIds.length) return { error: "Pick at least one department." } as const;
  }
  if (audience === "PEOPLE") {
    staffIds = (await db.staff.findMany({ where: { id: { in: ints(f, "staffIds") }, active: true }, select: { id: true } })).map((s) => s.id);
    if (!staffIds.length) return { error: "Pick at least one person." } as const;
  }

  const expires = dateOrNull(f, "expiresAt");
  // A date picked without a time expires at the end of that day.
  if (expires) expires.setHours(23, 59, 59, 999);
  if (expires && expires < new Date()) return { error: "The expiry date is in the past." } as const;

  return {
    data: { title, message, audience, urgent: bool(f, "urgent"), pinned: bool(f, "pinned"), expiresAt: expires },
    departmentIds,
    staffIds,
  } as const;
}

export async function createAnnouncement(_: ActionState, f: FormData): Promise<ActionState> {
  const admin = await requireAdminOrHR();
  const p = await parse(f);
  if ("error" in p) return { error: p.error };
  const a = await db.announcement.create({
    data: {
      ...p.data,
      createdById: admin.id,
      departments: { connect: p.departmentIds.map((id) => ({ id })) },
      recipients: { connect: p.staffIds.map((id) => ({ id })) },
      reads: { create: { staffId: admin.id } }, // the author has obviously read it
    },
  });
  // No title here: the activity feed is visible to staff who may not be recipients.
  await logActivity("announcement", a.id, a.audience === "ALL" ? "sent an announcement to everyone" : "sent an announcement", admin.id);
  refresh();
  return { ok: true };
}

export async function updateAnnouncement(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  await requireManageable(id);
  const p = await parse(f);
  if ("error" in p) return { error: p.error };
  await db.announcement.update({
    where: { id },
    data: {
      ...p.data,
      departments: { set: p.departmentIds.map((id) => ({ id })) },
      recipients: { set: p.staffIds.map((id) => ({ id })) },
    },
  });
  refresh();
  redirect(`/admin/announcements/${id}`);
}

export async function deleteAnnouncement(f: FormData) {
  const id = Number(f.get("id"));
  await requireManageable(id);
  await db.announcement.deleteMany({ where: { id } });
  refresh();
  redirect("/admin/announcements");
}

export async function togglePin(f: FormData) {
  const id = Number(f.get("id"));
  await requireManageable(id);
  const a = await db.announcement.findUnique({ where: { id }, select: { pinned: true } });
  if (a) await db.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  refresh();
}

/** Marks one announcement as read, if the user is actually a recipient. */
export async function markRead(id: number) {
  const user = await requireUser();
  const visible = await db.announcement.count({ where: { AND: [{ id }, visibleWhere(user)] } });
  if (visible) await db.announcementRead.upsert({ where: { announcementId_staffId: { announcementId: id, staffId: user.id } }, create: { announcementId: id, staffId: user.id }, update: {} });
  refresh();
}

export async function markAllRead() {
  const user = await requireUser();
  const unread = await db.announcement.findMany({ where: unreadWhere(user), select: { id: true } });
  if (unread.length) await db.announcementRead.createMany({ data: unread.map((a) => ({ announcementId: a.id, staffId: user.id })), skipDuplicates: true });
  refresh();
}
