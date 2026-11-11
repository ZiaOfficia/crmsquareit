"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { str, reqStr, bool, num, intOrNull, dateOrNull, type ActionState } from "@/lib/forms";
import { PAYMENT_TYPES, billingOf } from "@/lib/customer-billing";

function customerData(f: FormData) {
  return {
    company: reqStr(f, "company"),
    vat: str(f, "vat"),
    phone: str(f, "phone"),
    website: str(f, "website"),
    address: str(f, "address"),
    city: str(f, "city"),
    state: str(f, "state"),
    zip: str(f, "zip"),
    country: str(f, "country"),
    currency: str(f, "currency"),
    notes: str(f, "notes"),
  };
}

export async function createCustomer(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("customers", "create");
  const data = customerData(f);
  if (!data.company) return { error: "Company name is required." };
  const c = await db.customer.create({ data });
  const first = str(f, "contact_first");
  const email = str(f, "contact_email");
  if (first && email)
    await db.contact.create({ data: { customerId: c.id, firstName: first, lastName: reqStr(f, "contact_last"), email, phone: str(f, "contact_phone"), isPrimary: true } });
  await logActivity("customer", c.id, `created customer ${c.company}`, user.id);
  redirect(`/admin/customers/${c.id}`);
}

export async function updateCustomer(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("customers", "edit");
  const data = { ...customerData(f), active: bool(f, "active") };
  if (!data.company) return { error: "Company name is required." };
  await db.customer.update({ where: { id }, data });
  await logActivity("customer", id, `updated customer ${data.company}`, user.id);
  redirect(`/admin/customers/${id}`);
}

export async function deleteCustomer(f: FormData) {
  const user = await requirePerm("customers", "delete");
  const id = Number(f.get("id"));
  const c = await db.customer.findUnique({ where: { id }, include: { _count: { select: { invoices: true, estimates: true, projects: true } } } });
  if (!c) redirect("/admin/customers");
  if (c._count.invoices + c._count.estimates + c._count.projects > 0) {
    // Keep financial history: deactivate instead of deleting
    await db.customer.update({ where: { id }, data: { active: false } });
  } else {
    await db.customer.delete({ where: { id } });
  }
  await logActivity("customer", id, `deleted customer ${c.company}`, user.id);
  redirect("/admin/customers");
}

export async function saveContact(customerId: number, _: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("customers", "edit");
  const id = Number(f.get("id") || 0);
  const data = {
    firstName: reqStr(f, "firstName"),
    lastName: reqStr(f, "lastName"),
    email: reqStr(f, "email"),
    phone: str(f, "phone"),
    title: str(f, "title"),
    isPrimary: bool(f, "isPrimary"),
  };
  if (!data.firstName || !data.email) return { error: "First name and email are required." };
  if (data.isPrimary) await db.contact.updateMany({ where: { customerId }, data: { isPrimary: false } });
  if (id) await db.contact.update({ where: { id }, data });
  else await db.contact.create({ data: { ...data, customerId } });
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

export async function deleteContact(f: FormData) {
  await requirePerm("customers", "edit");
  const id = Number(f.get("id"));
  const c = await db.contact.delete({ where: { id } });
  revalidatePath(`/admin/customers/${c.customerId}`);
}

/** Record money received from a customer: advance, paid at once, part payment or final balance. */
export async function addCustomerPayment(customerId: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("customers", "edit");
  const type = String(f.get("type") ?? "");
  if (!PAYMENT_TYPES[type]) return { error: "Pick the payment type." };
  const b = await billingOf(customerId);
  let amount = num(f, "amount");
  // "Paid at once" and "Final balance" default to whatever is still outstanding.
  if (!amount && (type === "FULL" || type === "BALANCE")) amount = b.outstanding;
  if (!(amount > 0)) return { error: "Enter the amount received." };
  if (b.billed > 0 && amount > b.outstanding + 0.5)
    return { error: `That is more than the outstanding amount (${b.outstanding.toLocaleString("en-IN")}).` };
  const p = await db.customerPayment.create({
    data: {
      customerId,
      type,
      amount,
      quotationId: intOrNull(f, "quotationId"),
      mode: str(f, "mode"),
      date: dateOrNull(f, "date") ?? new Date(),
      reference: str(f, "reference"),
      note: str(f, "note"),
      staffId: user.id,
    },
  });
  await logActivity("customer", customerId, `recorded ${PAYMENT_TYPES[type].label.toLowerCase()} of ${p.amount.toLocaleString("en-IN")}`, user.id);
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  return { ok: true };
}

export async function deleteCustomerPayment(f: FormData) {
  const user = await requirePerm("customers", "edit");
  const id = Number(f.get("id"));
  const p = await db.customerPayment.delete({ where: { id } });
  await logActivity("customer", p.customerId, `deleted a ${PAYMENT_TYPES[p.type]?.label.toLowerCase() ?? "payment"} of ${p.amount.toLocaleString("en-IN")}`, user.id);
  revalidatePath(`/admin/customers/${p.customerId}`);
  revalidatePath("/admin/customers");
}
