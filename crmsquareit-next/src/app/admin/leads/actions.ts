"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, num, intOrNull, dateOrNull, type ActionState } from "@/lib/forms";
import { FOLLOW_UP_CHANNELS } from "@/lib/lead-flow";
import { docNumber } from "@/lib/sales";

function leadData(f: FormData) {
  return {
    name: reqStr(f, "name"),
    company: str(f, "company"),
    title: str(f, "title"),
    email: str(f, "email"),
    phone: str(f, "phone"),
    website: str(f, "website"),
    address: str(f, "address"),
    city: str(f, "city"),
    country: str(f, "country"),
    value: num(f, "value"),
    description: str(f, "description"),
    statusId: intOrNull(f, "statusId") ?? 0,
    sourceId: intOrNull(f, "sourceId"),
    assignedId: intOrNull(f, "assignedId"),
  };
}

export async function createLead(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("leads", "create");
  const data = leadData(f);
  if (!data.name) return { error: "Lead name is required." };
  if (!data.statusId) data.statusId = (await db.leadStatus.findFirst({ orderBy: [{ isDefault: "desc" }, { order: "asc" }] }))!.id;
  const lead = await db.lead.create({ data });
  await logActivity("lead", lead.id, `created lead ${lead.name}`, user.id);
  redirect(`/admin/leads/${lead.id}`);
}

export async function updateLead(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("leads", "edit");
  const data = leadData(f);
  if (!data.name) return { error: "Lead name is required." };
  await db.lead.update({ where: { id }, data });
  await logActivity("lead", id, `updated lead ${data.name}`, user.id);
  redirect(`/admin/leads/${id}`);
}

export async function moveLead(id: number, statusId: number) {
  const user = await requirePerm("leads", "edit");
  const lead = await db.lead.update({ where: { id }, data: { statusId }, include: { status: true } });
  await logActivity("lead", id, `moved lead ${lead.name} to ${lead.status.name}`, user.id);
  revalidatePath("/admin/leads");
}

export async function setLeadFlag(f: FormData) {
  const user = await requirePerm("leads", "edit");
  const id = Number(f.get("id"));
  const flag = String(f.get("flag")) as "lost" | "junk";
  const value = f.get("value") === "1";
  const lead = await db.lead.update({ where: { id }, data: { [flag]: value } });
  await logActivity("lead", id, `${value ? "marked" : "unmarked"} lead ${lead.name} as ${flag}`, user.id);
  revalidatePath(`/admin/leads/${id}`);
}

export async function touchLead(f: FormData) {
  await requirePerm("leads", "edit");
  const id = Number(f.get("id"));
  await db.lead.update({ where: { id }, data: { lastContact: new Date() } });
  revalidatePath(`/admin/leads/${id}`);
}

/** Log a follow-up (call / WhatsApp / email / meeting). Its outcome can sort the lead into hot, cold or junk. */
export async function logFollowUp(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("leads", "edit");
  const leadId = Number(f.get("leadId"));
  const channel = String(f.get("channel") ?? "CALL");
  const outcome = str(f, "outcome");
  const note = str(f, "note");
  const nextDate = dateOrNull(f, "nextDate");
  if (!FOLLOW_UP_CHANNELS[channel]) return { error: "Pick how you followed up." };
  if (outcome && !["HOT", "COLD", "JUNK"].includes(outcome)) return { error: "Unknown outcome." };
  if (!note && !outcome) return { error: "Write what happened or pick an outcome." };
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  await db.followUp.create({ data: { leadId, staffId: user.id, channel, note, outcome, nextDate } });
  await db.lead.update({
    where: { id: leadId },
    data: {
      lastContact: new Date(),
      nextFollowUp: outcome === "JUNK" ? null : nextDate,
      ...(outcome === "HOT" || outcome === "COLD" ? { temperature: outcome, junk: false } : {}),
      ...(outcome === "JUNK" ? { junk: true } : {}),
    },
  });
  const how = FOLLOW_UP_CHANNELS[channel].toLowerCase();
  await logActivity("lead", leadId, `followed up with ${lead.name} by ${how}${outcome ? ` · marked ${outcome.toLowerCase()}` : ""}`, user.id);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Sort a lead into hot / cold / junk, or back to undecided ("OPEN"). */
export async function setLeadStage(f: FormData) {
  const user = await requirePerm("leads", "edit");
  const id = Number(f.get("id"));
  const stage = String(f.get("stage"));
  const data =
    stage === "HOT" || stage === "COLD"
      ? { temperature: stage, junk: false }
      : stage === "JUNK"
        ? { junk: true, nextFollowUp: null }
        : { temperature: null, junk: false };
  const lead = await db.lead.update({ where: { id }, data });
  await logActivity("lead", id, stage === "OPEN" ? `reopened lead ${lead.name}` : `marked lead ${lead.name} as ${stage.toLowerCase()}`, user.id);
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin");
}

export async function convertLead(f: FormData) {
  const user = await requirePerm("customers", "create");
  const id = Number(f.get("id"));
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) redirect("/admin/leads");
  if (lead.customerId) redirect(`/admin/customers/${lead.customerId}`);
  const [first, ...rest] = lead.name.split(" ");
  const customer = await db.customer.create({
    data: {
      company: lead.company || lead.name,
      phone: lead.phone,
      website: lead.website,
      address: lead.address,
      city: lead.city,
      country: lead.country,
      contacts: lead.email ? { create: { firstName: first, lastName: rest.join(" "), email: lead.email, phone: lead.phone, title: lead.title, isPrimary: true } } : undefined,
    },
  });
  const customerStatus = await db.leadStatus.findFirst({ where: { name: "Customer" } });
  await db.lead.update({ where: { id }, data: { customerId: customer.id, junk: false, lost: false, nextFollowUp: null, ...(customerStatus ? { statusId: customerStatus.id } : {}) } });
  // Quotations made for the lead now also belong to the new customer.
  await db.quotation.updateMany({ where: { leadId: id, customerId: null }, data: { customerId: customer.id } });
  // Converting means the deal is won: the accepted quotation (or else the latest sent one, or else the
  // latest draft) becomes the customer's billed amount.
  const won =
    (await db.quotation.findFirst({ where: { leadId: id, status: "ACCEPTED" } })) ??
    (await db.quotation.findFirst({ where: { leadId: id, status: "SENT" }, orderBy: [{ date: "desc" }, { id: "desc" }] })) ??
    (await db.quotation.findFirst({ where: { leadId: id, status: "DRAFT" }, orderBy: [{ date: "desc" }, { id: "desc" }] }));
  if (won && won.status !== "ACCEPTED") {
    await db.quotation.update({ where: { id: won.id }, data: { status: "ACCEPTED" } });
    await logActivity("quotation", won.id, `marked as accepted quotation ${docNumber(won.prefix, won.number)} (lead converted)`, user.id);
  }
  const notes = await db.note.findMany({ where: { relType: "lead", relId: id } });
  if (notes.length)
    await db.note.createMany({ data: notes.map((n) => ({ relType: "customer", relId: customer.id, content: n.content, staffId: n.staffId, createdAt: n.createdAt })) });
  await logActivity("lead", id, `converted lead ${lead.name} to customer`, user.id);
  redirect(`/admin/customers/${customer.id}?tab=payments`);
}

export async function deleteLead(f: FormData) {
  const user = await requirePerm("leads", "delete");
  const id = Number(f.get("id"));
  const lead = await db.lead.delete({ where: { id } });
  await db.note.deleteMany({ where: { relType: "lead", relId: id } });
  await logActivity("lead", id, `deleted lead ${lead.name}`, user.id);
  redirect("/admin/leads");
}
