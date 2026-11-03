"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { calcTotals, docNumber, newHash, nextEstimateNumber, nextInvoiceNumber, parseItems } from "@/lib/sales";
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
      expiryDate: dateOrNull(f, "secondDate"),
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

export async function createEstimate(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("estimates", "create");
  const { items, data } = docData(f);
  if (!data.customerId) return { error: "Please select a customer." };
  if (!items.length) return { error: "Add at least one line item." };
  const s = await getSettings();
  const est = await db.estimate.create({
    data: { ...data, number: await nextEstimateNumber(), prefix: s.estimate_prefix, hash: newHash(), items: { create: itemRows(items) } },
  });
  await logActivity("estimate", est.id, `created estimate ${docNumber(est.prefix, est.number)}`, user.id);
  redirect(`/admin/estimates/${est.id}`);
}

export async function updateEstimate(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("estimates", "edit");
  const { items, data } = docData(f);
  if (!data.customerId) return { error: "Please select a customer." };
  if (!items.length) return { error: "Add at least one line item." };
  await db.$transaction([db.lineItem.deleteMany({ where: { estimateId: id } }), db.estimate.update({ where: { id }, data: { ...data, items: { create: itemRows(items) } } })]);
  await logActivity("estimate", id, `updated estimate`, user.id);
  redirect(`/admin/estimates/${id}`);
}

export async function setEstimateStatus(f: FormData) {
  const user = await requirePerm("estimates", "edit");
  const id = Number(f.get("id"));
  const status = String(f.get("status"));
  const est = await db.estimate.update({ where: { id }, data: { status } });
  await logActivity("estimate", id, `marked estimate ${docNumber(est.prefix, est.number)} as ${status.toLowerCase()}`, user.id);
  revalidatePath(`/admin/estimates/${id}`);
}

export async function convertToInvoice(f: FormData) {
  const user = await requirePerm("invoices", "create");
  const id = Number(f.get("id"));
  const est = await db.estimate.findUnique({ where: { id }, include: { items: true } });
  if (!est) redirect("/admin/estimates");
  if (est.invoiceId) redirect(`/admin/invoices/${est.invoiceId}`);
  const s = await getSettings();
  const inv = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      prefix: s.invoice_prefix,
      hash: newHash(),
      customerId: est.customerId,
      projectId: est.projectId,
      date: new Date(),
      dueDate: new Date(Date.now() + Number(s.invoice_due_days || 0) * 86400000),
      currency: est.currency,
      subtotal: est.subtotal,
      discountPercent: est.discountPercent,
      discountTotal: est.discountTotal,
      taxTotal: est.taxTotal,
      adjustment: est.adjustment,
      total: est.total,
      clientNote: s.invoice_client_note,
      terms: est.terms,
      items: { create: est.items.map(({ id: _a, invoiceId: _b, estimateId: _c, ...it }) => it) },
    },
  });
  await db.estimate.update({ where: { id }, data: { invoiceId: inv.id, status: "ACCEPTED" } });
  await logActivity("estimate", id, `converted estimate ${docNumber(est.prefix, est.number)} to invoice`, user.id);
  redirect(`/admin/invoices/${inv.id}`);
}

export async function deleteEstimate(f: FormData) {
  const user = await requirePerm("estimates", "delete");
  const id = Number(f.get("id"));
  const est = await db.estimate.delete({ where: { id } });
  await logActivity("estimate", id, `deleted estimate ${docNumber(est.prefix, est.number)}`, user.id);
  redirect("/admin/estimates");
}
