/** Office expenses: categories and month helpers. Safe to import from client and server code. */
import type { Tone } from "./constants";

export const OFFICE_EXPENSE_CATEGORIES = [
  { key: "RENT", label: "Rent" },
  { key: "ELECTRICITY", label: "Electricity & water" },
  { key: "INTERNET", label: "Internet & phone" },
  { key: "SUPPLIES", label: "Stationery & supplies" },
  { key: "PANTRY", label: "Pantry & refreshments" },
  { key: "CLEANING", label: "Cleaning & housekeeping" },
  { key: "MAINTENANCE", label: "Repairs & maintenance" },
  { key: "EQUIPMENT", label: "Equipment & furniture" },
  { key: "SOFTWARE", label: "Software & subscriptions" },
  { key: "TRAVEL", label: "Travel & conveyance" },
  { key: "COURIER", label: "Courier & postage" },
  { key: "WELFARE", label: "Staff welfare & events" },
  { key: "OTHER", label: "Miscellaneous" },
] as const;
export type OfficeExpenseCategory = (typeof OFFICE_EXPENSE_CATEGORIES)[number]["key"];
export const isOfficeCategory = (v: unknown): v is OfficeExpenseCategory => OFFICE_EXPENSE_CATEGORIES.some((c) => c.key === v);
export const officeCategoryLabel = (k: string) => OFFICE_EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k;

export const REPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Not submitted", tone: "gray" },
  SUBMITTED: { label: "Awaiting review", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  RETURNED: { label: "Sent back", tone: "red" },
};

/** "2026-11" for a date (local time). */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Parses "2026-11"; falls back to the current month. */
export function parseMonth(v: string | undefined | null) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v ?? "");
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Number(m[2]) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { key: monthKey(start), start, end, label: start.toLocaleString("en-GB", { month: "long", year: "numeric" }) };
}

export const shiftMonth = (key: string, by: number) => {
  const { start } = parseMonth(key);
  return monthKey(new Date(start.getFullYear(), start.getMonth() + by, 1));
};

/** HR can't change a month once it's submitted or approved. Super Admins always can. */
export const isLocked = (status: string | null | undefined) => status === "SUBMITTED" || status === "APPROVED";
