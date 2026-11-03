"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { calcTotals, docNumber, newHash, nextInvoiceNumber, parseItems, refreshInvoiceStatus } from "@/lib/sales";
import { str, num, intOrNull, dateOrNull, reqStr, type ActionState } from "@/lib/forms";

function docData(f: FormData) {
  const items = parseItems(f);
  const discountPercent = num(f, "discountPercent");
  const adjustment = num(f, "adjustment");
  return {
    items,
    data: {
      customerId: intOrNull(f, "customerId") ?? 0,
      projectId: intOrNull(f, "projectId"),
      date: dateOrNull(f, "date") ?? new Date(),
      dueDate: dateOrNull(f, "secondDate"),
      currency: reqStr(f, "currency") || "INR",
      discountPercent,
      adjustment,
      clientNote: str(f, "clientNote"),
      terms: str(f, "terms"),
      ...calcTotals(items, discountPercent, adjustment),
    },
  };
}
const itemRows = (items: ReturnType<typeof parseItems>) => items.map((i, k) => ({ ...i, sortOrder: k }));

export async function createInvoice(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("invoices", "create");
  const { items, data } = docData(f);
  if (!data.customerId) return { error: "Please select a customer." };
  if (!items.length) return { error: "Add at least one line item." };
  const s = await getSettings();
  const inv = await db.invoice.create({
    data: { ...data, number: await nextInvoiceNumber(), prefix: s.invoice_prefix, hash: newHash(), status: "DRAFT", items: { create: itemRows(items) } },
  });
  await logActivity("invoice", inv.id, `created invoice ${docNumber(inv.prefix, inv.number)}`, user.id);
  redirect(`/admin/invoices/${inv.id}`);
}

export async function updateInvoice(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("invoices", "edit");
  const { items, data } = docData(f);
  if (!data.customerId) return { error: "Please select a customer." };
  if (!items.length) return { error: "Add at least one line item." };
  await db.$transaction([db.lineItem.deleteMany({ where: { invoiceId: id } }), db.invoice.update({ where: { id }, data: { ...data, items: { create: itemRows(items) } } })]);
  await refreshInvoiceStatus(id);
  await logActivity("invoice", id, `updated invoice`, user.id);
  redirect(`/admin/invoices/${id}`);
}

export async function setInvoiceStatus(f: FormData) {
  const user = await requirePerm("invoices", "edit");
  const id = Number(f.get("id"));
  const status = String(f.get("status"));
  const data: { status: string; sentAt?: Date } = { status };
  if (status === "UNPAID") data.sentAt = new Date();
  const inv = await db.invoice.update({ where: { id }, data });
  if (status === "UNPAID") await refreshInvoiceStatus(id);
  await logActivity("invoice", id, `marked invoice ${docNumber(inv.prefix, inv.number)} as ${status.toLowerCase()}`, user.id);
  revalidatePath(`/admin/invoices/${id}`);
}

export async function recordPayment(invoiceId: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("payments", "create");
  const amount = num(f, "amount");
  if (amount <= 0) return { error: "Amount must be greater than zero." };
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "DRAFT") await db.invoice.update({ where: { id: invoiceId }, data: { status: "UNPAID" } });
  await db.payment.create({
    data: { invoiceId, amount, mode: reqStr(f, "mode") || "Bank transfer", date: dateOrNull(f, "date") ?? new Date(), transactionId: str(f, "transactionId"), note: str(f, "note") },
  });
  await refreshInvoiceStatus(invoiceId);
  await logActivity("invoice", invoiceId, `recorded payment of ${amount} on ${docNumber(inv.prefix, inv.number)}`, user.id);
  revalidatePath(`/admin/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deletePayment(f: FormData) {
  await requirePerm("payments", "delete");
  const id = Number(f.get("id"));
  const p = await db.payment.delete({ where: { id } });
  await refreshInvoiceStatus(p.invoiceId);
  revalidatePath(`/admin/invoices/${p.invoiceId}`);
  revalidatePath(`/admin/payments`);
}

export async function deleteInvoice(f: FormData) {
  const user = await requirePerm("invoices", "delete");
  const id = Number(f.get("id"));
  const inv = await db.invoice.delete({ where: { id } });
  await logActivity("invoice", id, `deleted invoice ${docNumber(inv.prefix, inv.number)}`, user.id);
  redirect("/admin/invoices");
}

export async function duplicateInvoice(f: FormData) {
  const user = await requirePerm("invoices", "create");
  const id = Number(f.get("id"));
  const src = await db.invoice.findUnique({ where: { id }, include: { items: true } });
  if (!src) redirect("/admin/invoices");
  const { id: _i, hash: _h, number: _n, createdAt: _c, sentAt: _s, status: _st, ...rest } = src;
  const inv = await db.invoice.create({
    data: {
      ...rest,
      items: { create: src.items.map(({ id: _x, invoiceId: _y, estimateId: _z, ...it }) => it) },
      number: await nextInvoiceNumber(),
      hash: newHash(),
      status: "DRAFT",
      date: new Date(),
    },
  });
  await logActivity("invoice", inv.id, `duplicated invoice`, user.id);
  redirect(`/admin/invoices/${inv.id}`);
}
