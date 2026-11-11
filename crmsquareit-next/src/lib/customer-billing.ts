import "server-only";
import { db } from "./db";

/** How a customer paid: an advance up front, the whole amount at once, part payments, or the final balance. */
export const PAYMENT_TYPES: Record<string, { label: string; hint: string }> = {
  ADVANCE: { label: "Advance", hint: "Paid up front, before work starts" },
  FULL: { label: "Paid at once", hint: "The full amount in one payment" },
  PART: { label: "Part payment", hint: "An instalment in between" },
  BALANCE: { label: "Final balance", hint: "The remaining amount" },
};

export type Billing = {
  billed: number;
  /** "quotations" when billed comes from won quotations, "invoices" for customers without one. */
  billedFrom: "quotations" | "invoices" | null;
  advance: number;
  full: number;
  part: number;
  invoicePaid: number;
  paid: number;
  outstanding: number;
};

const empty = (): Billing => ({ billed: 0, billedFrom: null, advance: 0, full: 0, part: 0, invoicePaid: 0, paid: 0, outstanding: 0 });

/**
 * Billing for many customers at once.
 * Total billed = the customer's accepted (won) quotations. A customer who never had a quotation
 * (e.g. added by hand and billed through invoices) falls back to their sent invoices.
 * Paid = customer payments (advance / at once / part / balance) + payments recorded on invoices.
 */
export async function billingFor(customerIds: number[]): Promise<Record<number, Billing>> {
  const out: Record<number, Billing> = Object.fromEntries(customerIds.map((id) => [id, empty()]));
  if (!customerIds.length) return out;
  const ids = { in: customerIds };
  const [quotes, invoices, pays, invoicePays] = await Promise.all([
    db.quotation.groupBy({ by: ["customerId"], where: { customerId: ids, status: "ACCEPTED" }, _sum: { total: true } }),
    db.invoice.groupBy({ by: ["customerId"], where: { customerId: ids, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { total: true } }),
    db.customerPayment.groupBy({ by: ["customerId", "type"], where: { customerId: ids }, _sum: { amount: true } }),
    db.payment.findMany({ where: { invoice: { customerId: ids } }, select: { amount: true, invoice: { select: { customerId: true } } } }),
  ]);
  for (const q of quotes) if (q.customerId) Object.assign(out[q.customerId], { billed: q._sum.total ?? 0, billedFrom: "quotations" });
  for (const i of invoices) {
    const b = out[i.customerId];
    if (b.billedFrom === null && (i._sum.total ?? 0) > 0) Object.assign(b, { billed: i._sum.total ?? 0, billedFrom: "invoices" });
  }
  for (const p of pays) {
    const b = out[p.customerId];
    const amt = p._sum.amount ?? 0;
    if (p.type === "ADVANCE") b.advance += amt;
    else if (p.type === "FULL") b.full += amt;
    else b.part += amt;
  }
  for (const p of invoicePays) out[p.invoice.customerId].invoicePaid += p.amount;
  for (const b of Object.values(out)) {
    b.paid = b.advance + b.full + b.part + b.invoicePaid;
    b.outstanding = Math.max(0, Math.round((b.billed - b.paid) * 100) / 100);
  }
  return out;
}

export async function billingOf(customerId: number) {
  return (await billingFor([customerId]))[customerId];
}
