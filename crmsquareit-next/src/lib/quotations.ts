import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export async function nextQuotationNumber() {
  const last = await db.quotation.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

/** "Expired" is shown, not stored: a draft or sent quotation past its validity date. */
export const displayStatus = (q: { status: string; validUntil: Date | null }) =>
  (q.status === "DRAFT" || q.status === "SENT") && q.validUntil && q.validUntil < new Date(new Date().toDateString()) ? "EXPIRED" : q.status;

/** Super Admin and BDE Team Leads see every quotation; everyone else sees the ones they made. */
export function quotationScope(u: CurrentUser): Prisma.QuotationWhereInput {
  if (u.isAdmin || u.memberships.some((m) => m.departmentCode === "BDE" && m.teamRole === "TL")) return {};
  return { createdById: u.id };
}

export const canSeeQuotation = (u: CurrentUser, q: { createdById: number | null }) =>
  Object.keys(quotationScope(u)).length === 0 || q.createdById === u.id;

export const quotationInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  lead: { select: { id: true, name: true, company: true, customerId: true } },
  customer: { select: { id: true, company: true } },
  createdBy: { select: { firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.QuotationInclude;
