import type { Prisma } from "@prisma/client";
import type { Tone } from "./constants";

/**
 * The BDE lead journey:
 *   New lead → Quotation sent → Follow-up → Hot / Cold / Junk → Customer
 *
 * The stage is worked out from the lead's data, never stored, so it can't drift:
 * a sent quotation moves a lead to "Quotation sent", a logged follow-up to "Follow-up",
 * the Hot / Cold / Junk decision sets `temperature` / `junk`, converting sets `customerId`.
 */
export const LEAD_STAGES = ["NEW", "QUOTED", "FOLLOW_UP", "HOT", "COLD", "JUNK", "CUSTOMER"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_INFO: Record<LeadStage, { label: string; short: string; tone: Tone; color: string; next: string }> = {
  NEW: { label: "New lead", short: "New", tone: "blue", color: "#4f74c4", next: "Send a quotation" },
  QUOTED: { label: "Quotation sent", short: "Quoted", tone: "purple", color: "#7c5cc4", next: "Follow up on the quotation" },
  FOLLOW_UP: { label: "Follow-up", short: "Follow-up", tone: "amber", color: "#e0a400", next: "Decide: hot, cold or junk" },
  HOT: { label: "Hot lead", short: "Hot", tone: "red", color: "#e5484d", next: "Close the deal and convert" },
  COLD: { label: "Cold lead", short: "Cold", tone: "blue", color: "#0f9fb0", next: "Keep nurturing" },
  JUNK: { label: "Junk lead", short: "Junk", tone: "gray", color: "#8a94a6", next: "No action" },
  CUSTOMER: { label: "Customer", short: "Customer", tone: "green", color: "#27ae57", next: "Won" },
};

export const FOLLOW_UP_CHANNELS: Record<string, string> = { CALL: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email", MEETING: "Meeting" };

/** Quotation statuses that mean the client actually received it. */
const SENT: string[] = ["SENT", "ACCEPTED", "DECLINED"];

export function leadStage(l: {
  customerId: number | null;
  junk: boolean;
  temperature: string | null;
  followUpCount: number;
  sentQuotes: number;
}): LeadStage {
  if (l.customerId) return "CUSTOMER";
  if (l.junk) return "JUNK";
  if (l.temperature === "HOT") return "HOT";
  if (l.temperature === "COLD") return "COLD";
  if (l.followUpCount > 0) return "FOLLOW_UP";
  if (l.sentQuotes > 0) return "QUOTED";
  return "NEW";
}

/** Include this on a lead query to be able to call `stageOf(lead)`. */
export const stageInclude = {
  _count: { select: { followUps: true, quotations: { where: { status: { in: SENT } } } } },
} satisfies Prisma.LeadInclude;

export const stageOf = (l: { customerId: number | null; junk: boolean; temperature: string | null; _count: { followUps: number; quotations: number } }) =>
  leadStage({ ...l, followUpCount: l._count.followUps, sentQuotes: l._count.quotations });

/** Prisma filter for the leads in one stage (lost leads are left out of the open stages). */
export function stageWhere(stage: LeadStage): Prisma.LeadWhereInput {
  const open: Prisma.LeadWhereInput = { customerId: null, junk: false, lost: false };
  const sent: Prisma.LeadWhereInput = { quotations: { some: { status: { in: SENT } } } };
  switch (stage) {
    case "CUSTOMER":
      return { customerId: { not: null } };
    case "JUNK":
      return { customerId: null, junk: true };
    case "HOT":
    case "COLD":
      return { ...open, temperature: stage };
    case "FOLLOW_UP":
      return { ...open, temperature: null, followUps: { some: {} } };
    case "QUOTED":
      return { ...open, temperature: null, followUps: { none: {} }, ...sent };
    case "NEW":
      return { ...open, temperature: null, followUps: { none: {} }, NOT: sent };
  }
}
