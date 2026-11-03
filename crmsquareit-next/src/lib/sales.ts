import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { round2 } from "./format";

export type LineInput = {
  description: string;
  longDescription?: string | null;
  qty: number;
  rate: number;
  unit?: string | null;
  taxRate: number;
};

export function calcTotals(items: LineInput[], discountPercent: number, adjustment: number) {
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.rate, 0));
  const discountTotal = round2((subtotal * (discountPercent || 0)) / 100);
  const factor = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 1;
  const taxTotal = round2(items.reduce((s, i) => s + i.qty * i.rate * factor * (i.taxRate / 100), 0));
  const total = round2(subtotal - discountTotal + taxTotal + (adjustment || 0));
  return { subtotal, discountTotal, taxTotal, total };
}

/** Parse line items posted from <LineItemsEditor/> (hidden JSON field "items"). */
export function parseItems(f: FormData): LineInput[] {
  try {
    const raw = JSON.parse(String(f.get("items") || "[]")) as LineInput[];
    return raw
      .filter((i) => i.description && String(i.description).trim())
      .map((i) => ({
        description: String(i.description).trim(),
        longDescription: i.longDescription ? String(i.longDescription) : null,
        qty: Number(i.qty) || 0,
        rate: Number(i.rate) || 0,
        unit: i.unit ? String(i.unit) : null,
        taxRate: Number(i.taxRate) || 0,
      }));
  } catch {
    return [];
  }
}

export const newHash = () => randomBytes(16).toString("hex");

export async function nextInvoiceNumber() {
  const last = await db.invoice.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}
export async function nextEstimateNumber() {
  const last = await db.estimate.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

export const docNumber = (prefix: string, n: number) => `${prefix}${String(n).padStart(6, "0")}`;

/** Recompute invoice status from payments (keeps DRAFT/CANCELLED). */
export async function refreshInvoiceStatus(invoiceId: number) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv || inv.status === "CANCELLED") return;
  const paid = round2(inv.payments.reduce((s, p) => s + p.amount, 0));
  let status = inv.status;
  if (paid >= inv.total && inv.total > 0) status = "PAID";
  else if (paid > 0) status = "PARTIAL";
  else if (inv.status !== "DRAFT") status = "UNPAID";
  if (status !== inv.status) await db.invoice.update({ where: { id: invoiceId }, data: { status } });
}

export function isOverdue(inv: { status: string; dueDate: Date | null }) {
  return (inv.status === "UNPAID" || inv.status === "PARTIAL") && !!inv.dueDate && inv.dueDate < new Date(new Date().toDateString());
}
