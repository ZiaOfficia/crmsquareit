import "server-only";
import type { TaxInvoice } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { inputDate } from "@/lib/format";
import { financialYear, invoiceNumber, parseTaxItems } from "@/lib/tax-invoice";
import { nextTaxInvoiceSeq } from "@/lib/tax-invoice-server";
import type { TaxInvoiceFormValues } from "./form";

/** Everything <TaxInvoiceForm/> needs: lists, settings and the starting values. */
export async function taxInvoiceFormProps(inv?: TaxInvoice | null, preset?: { customerId?: number }) {
  const [s, customers, saved, taxes] = await Promise.all([
    getSettings(),
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.item.findMany({ orderBy: { description: "asc" }, select: { id: true, description: true, longDescription: true, rate: true, unit: true, taxRate: true } }),
    db.tax.findMany({ orderBy: { rate: "desc" }, select: { rate: true } }),
  ]);
  const today = new Date();
  const fy = financialYear(inv?.issueDate ?? today);
  const autoNumber = invoiceNumber(s.tinv_prefix || "SS", fy, await nextTaxInvoiceSeq(fy));
  const dueDays = Number(s.tinv_due_days || 0);

  let initial: TaxInvoiceFormValues;
  if (inv) {
    initial = {
      number: inv.number,
      issueDate: inputDate(inv.issueDate),
      dueDate: inputDate(inv.dueDate),
      customerId: inv.customerId ? String(inv.customerId) : "",
      billName: inv.billName,
      billAddress: inv.billAddress ?? "",
      billGstin: inv.billGstin ?? "",
      sameShip: !inv.shipName && !inv.shipAddress,
      shipName: inv.shipName ?? "",
      shipAddress: inv.shipAddress ?? "",
      placeOfSupply: inv.placeOfSupply,
      items: parseTaxItems(inv.items),
      terms: inv.terms ?? "",
      declaration: inv.declaration ?? "",
    };
  } else {
    const c = preset?.customerId ? await db.customer.findUnique({ where: { id: preset.customerId } }) : null;
    initial = {
      number: "",
      issueDate: inputDate(today),
      dueDate: dueDays ? inputDate(new Date(today.getTime() + dueDays * 86_400_000)) : "",
      customerId: c ? String(c.id) : "",
      billName: c?.company ?? "",
      billAddress: c ? [c.address, [c.city, c.zip].filter(Boolean).join("-"), c.state].filter(Boolean).join(", ") : "",
      billGstin: c?.vat ?? "",
      sameShip: true,
      shipName: "",
      shipAddress: "",
      placeOfSupply: c?.state ?? s.tinv_seller_state,
      items: [],
      terms: s.tinv_terms,
      declaration: s.tinv_declaration,
    };
  }
  return {
    initial,
    customers,
    saved,
    taxRates: [...new Set(taxes.map((t) => t.rate))],
    sellerState: s.tinv_seller_state,
    dueDays,
    autoNumber,
  };
}
