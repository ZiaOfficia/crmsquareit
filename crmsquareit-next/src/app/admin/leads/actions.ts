"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, num, intOrNull, type ActionState } from "@/lib/forms";

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
  await db.lead.update({ where: { id }, data: { customerId: customer.id, ...(customerStatus ? { statusId: customerStatus.id } : {}) } });
  const notes = await db.note.findMany({ where: { relType: "lead", relId: id } });
  if (notes.length)
    await db.note.createMany({ data: notes.map((n) => ({ relType: "customer", relId: customer.id, content: n.content, staffId: n.staffId, createdAt: n.createdAt })) });
  await logActivity("lead", id, `converted lead ${lead.name} to customer`, user.id);
  redirect(`/admin/customers/${customer.id}`);
}

export async function deleteLead(f: FormData) {
  const user = await requirePerm("leads", "delete");
  const id = Number(f.get("id"));
  const lead = await db.lead.delete({ where: { id } });
  await db.note.deleteMany({ where: { relType: "lead", relId: id } });
  await logActivity("lead", id, `deleted lead ${lead.name}`, user.id);
  redirect("/admin/leads");
}
