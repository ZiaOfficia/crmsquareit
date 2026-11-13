"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { dateOrNull, intOrNull, reqStr, str, type ActionState } from "@/lib/forms";
import { financialYear, invoiceNumber, invoiceTotals, parseTaxItems } from "@/lib/tax-invoice";
import { TAX_INVOICE_STATUSES, nextTaxInvoiceSeq } from "@/lib/tax-invoice-server";

/** "SS/26-27/070" → 70; anything without trailing digits → null. */
const seqOf = (n: string) => {
  const m = n.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
};

async function parse(f: FormData, currentId?: number) {
  const s = await getSettings();
  const items = parseTaxItems(f.get("items"));
  const billName = reqStr(f, "billName");
  const placeOfSupply = reqStr(f, "placeOfSupply");
  const issueDate = dateOrNull(f, "issueDate") ?? new Date();
  const dueDate = dateOrNull(f, "dueDate");
  if (!billName) return { error: "Add who the invoice is billed to." } as const;
  if (!placeOfSupply) return { error: "Pick the place of supply (decides CGST + SGST or IGST)." } as const;
  if (!items.length) return { error: "Add at least one item with a name." } as const;
  if (items.some((i) => i.qty <= 0)) return { error: "Each item needs a quantity above 0." } as const;
  if (items.some((i) => i.price < 0)) return { error: "Prices can't be negative." } as const;
  if (dueDate && dueDate < issueDate) return { error: "The due date is before the issued date." } as const;
  const gstin = str(f, "billGstin")?.toUpperCase().replace(/\s+/g, "") ?? null;
  if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return { error: "The GSTIN should be 15 characters, e.g. 09ABCDE1234F1Z5." } as const;

  // Number: typed by the user, or the next one in the issue date's financial year.
  const fy = financialYear(issueDate);
  let number = str(f, "number");
  let seq = number ? seqOf(number) : null;
  if (!number || seq === null) {
    seq = await nextTaxInvoiceSeq(fy);
    number = invoiceNumber(s.tinv_prefix || "SS", fy, seq);
  }
  const clash = await db.taxInvoice.findFirst({ where: { number, ...(currentId ? { NOT: { id: currentId } } : {}) }, select: { id: true } });
  if (clash) return { error: `Invoice number ${number} is already used. Clear the number to get the next free one.` } as const;

  const sameShip = f.get("sameShip") === "on";
  let customerId = intOrNull(f, "customerId");
  if (customerId && !(await db.customer.count({ where: { id: customerId } }))) customerId = null;
  const totals = invoiceTotals(items, placeOfSupply, s.tinv_seller_state);
  return {
    data: {
      number,
      seq,
      fy,
      customerId,
      issueDate,
      dueDate,
      billName,
      billAddress: str(f, "billAddress"),
      billGstin: gstin,
      shipName: sameShip ? null : str(f, "shipName"),
      shipAddress: sameShip ? null : str(f, "shipAddress"),
      placeOfSupply,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      terms: str(f, "terms"),
      declaration: str(f, "declaration"),
    },
  } as const;
}

export async function createTaxInvoice(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("invoices", "create");
  const p = await parse(f);
  if ("error" in p) return { error: p.error };
  let inv;
  try {
    inv = await db.taxInvoice.create({ data: { ...p.data, createdById: user.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `Invoice number ${p.data.number} was just used by someone else. Save again to take the next one.` };
    throw e;
  }
  await logActivity("tax_invoice", inv.id, `created tax invoice ${inv.number} for ${inv.billName}`, user.id);
  if (inv.customerId) await logActivity("customer", inv.customerId, `created tax invoice ${inv.number}`, user.id);
  redirect(`/admin/tax-invoices/${inv.id}`);
}

export async function updateTaxInvoice(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("invoices", "edit");
  const old = await db.taxInvoice.findUnique({ where: { id } });
  if (!old) redirect("/admin/tax-invoices");
  const p = await parse(f, id);
  if ("error" in p) return { error: p.error };
  await db.taxInvoice.update({ where: { id }, data: p.data });
  await logActivity("tax_invoice", id, `updated tax invoice ${p.data.number}`, user.id);
  redirect(`/admin/tax-invoices/${id}`);
}

export async function setTaxInvoiceStatus(f: FormData) {
  const user = await requirePerm("invoices", "edit");
  const id = Number(f.get("id"));
  const status = String(f.get("status"));
  if (!(TAX_INVOICE_STATUSES as readonly string[]).includes(status)) redirect(`/admin/tax-invoices/${id}`);
  const inv = await db.taxInvoice.update({ where: { id }, data: { status } });
  const verb = { UNPAID: "marked as unpaid", PAID: "marked as paid", CANCELLED: "cancelled" }[status];
  await logActivity("tax_invoice", id, `${verb} tax invoice ${inv.number}`, user.id);
  revalidatePath(`/admin/tax-invoices/${id}`);
  revalidatePath("/admin/tax-invoices");
}

/** Copies an invoice into a new one (next number, today's date) and opens it for editing. */
export async function duplicateTaxInvoice(f: FormData) {
  const user = await requirePerm("invoices", "create");
  const src = await db.taxInvoice.findUnique({ where: { id: Number(f.get("id")) } });
  if (!src) redirect("/admin/tax-invoices");
  const s = await getSettings();
  const issueDate = new Date();
  const fy = financialYear(issueDate);
  const seq = await nextTaxInvoiceSeq(fy);
  const { id: _i, createdAt: _c, updatedAt: _u, createdById: _b, status: _s, number: _n, seq: _q, fy: _f, issueDate: _d, dueDate: _dd, items, ...rest } = src;
  const days = Number(s.tinv_due_days || 0);
  const inv = await db.taxInvoice.create({
    data: {
      ...rest,
      items: items ?? [],
      number: invoiceNumber(s.tinv_prefix || "SS", fy, seq),
      seq,
      fy,
      issueDate,
      dueDate: days ? new Date(issueDate.getTime() + days * 86_400_000) : null,
      createdById: user.id,
    },
  });
  await logActivity("tax_invoice", inv.id, `duplicated tax invoice ${src.number} as ${inv.number}`, user.id);
  redirect(`/admin/tax-invoices/${inv.id}/edit`);
}

export async function deleteTaxInvoice(f: FormData) {
  const user = await requirePerm("invoices", "delete");
  const inv = await db.taxInvoice.findUnique({ where: { id: Number(f.get("id")) } });
  if (!inv) redirect("/admin/tax-invoices");
  await db.taxInvoice.delete({ where: { id: inv.id } });
  await logActivity("tax_invoice", inv.id, `deleted tax invoice ${inv.number}`, user.id);
  redirect("/admin/tax-invoices");
}

/** For the customer picker: billing details to prefill the form. */
export async function customerBilling(customerId: number) {
  await requirePerm("invoices");
  const c = await db.customer.findUnique({ where: { id: customerId } });
  if (!c) return null;
  return {
    billName: c.company,
    billAddress: [c.address, [c.city, c.zip].filter(Boolean).join("-"), c.state].filter(Boolean).join(", "),
    billGstin: c.vat ?? "",
    state: c.state ?? "",
  };
}
