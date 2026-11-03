"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, intOrNull, type ActionState } from "@/lib/forms";

export async function createTicket(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("tickets", "create");
  const subject = reqStr(f, "subject");
  const message = reqStr(f, "message");
  if (!subject || !message) return { error: "Subject and message are required." };
  const contactId = intOrNull(f, "contactId");
  let customerId = intOrNull(f, "customerId");
  if (contactId && !customerId) customerId = (await db.contact.findUnique({ where: { id: contactId } }))?.customerId ?? null;
  const t = await db.ticket.create({
    data: {
      subject, message, customerId, contactId,
      name: str(f, "name"), email: str(f, "email"),
      departmentId: intOrNull(f, "departmentId"), projectId: intOrNull(f, "projectId"),
      priority: reqStr(f, "priority") || "MEDIUM", assignedId: intOrNull(f, "assignedId"),
    },
  });
  await logActivity("ticket", t.id, `opened ticket #${t.id} ${t.subject}`, user.id);
  redirect(`/admin/tickets/${t.id}`);
}

export async function replyTicket(ticketId: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("tickets", "edit");
  const message = reqStr(f, "message");
  if (!message) return { error: "Reply cannot be empty." };
  const status = reqStr(f, "status") || "ANSWERED";
  await db.ticketReply.create({ data: { ticketId, staffId: user.id, message } });
  await db.ticket.update({ where: { id: ticketId }, data: { status, lastReply: new Date() } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true };
}

export async function updateTicketMeta(f: FormData) {
  const user = await requirePerm("tickets", "edit");
  const id = Number(f.get("id"));
  await db.ticket.update({
    where: { id },
    data: { status: reqStr(f, "status"), priority: reqStr(f, "priority"), assignedId: intOrNull(f, "assignedId"), departmentId: intOrNull(f, "departmentId") },
  });
  await logActivity("ticket", id, `updated ticket #${id}`, user.id);
  revalidatePath(`/admin/tickets/${id}`);
}

export async function deleteTicket(f: FormData) {
  await requirePerm("tickets", "delete");
  await db.ticket.delete({ where: { id: Number(f.get("id")) } });
  redirect("/admin/tickets");
}
