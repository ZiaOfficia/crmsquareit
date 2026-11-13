import "server-only";
import { db } from "./db";
import type { Tone } from "./constants";

export const TAX_INVOICE_STATUSES = ["UNPAID", "PAID", "CANCELLED"] as const;

export const TAX_INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  UNPAID: { label: "Unpaid", tone: "amber" },
  OVERDUE: { label: "Overdue", tone: "red" },
  PAID: { label: "Paid", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

/** Unpaid and past the due date (India time) → shown as overdue. */
export function taxInvoiceDisplayStatus(i: { status: string; dueDate: Date | null }) {
  if (i.status !== "UNPAID" || !i.dueDate) return i.status;
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const due = new Date(i.dueDate.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
  return due < today ? "OVERDUE" : i.status;
}

/** Next running number inside a financial year ("26-27"). */
export async function nextTaxInvoiceSeq(fy: string) {
  const last = await db.taxInvoice.aggregate({ where: { fy }, _max: { seq: true } });
  return (last._max.seq ?? 0) + 1;
}
