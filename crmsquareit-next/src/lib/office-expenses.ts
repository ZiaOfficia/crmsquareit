/** Office expenses: categories and month helpers. Safe to import from client and server code. */
import type { Tone } from "./constants";
import { indiaMonthStart } from "./india-time";

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

/** "2026-11" for a saved calendar-day value. */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
/** "2026-11" for the current month in India. */
export const thisMonthKey = () => monthKey(indiaMonthStart());

/** Parses "2026-11"; falls back to the current month. */
export function parseMonth(v: string | undefined | null) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v ?? "");
  const now = indiaMonthStart();
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { key: monthKey(start), start, end, label: start.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

export const shiftMonth = (key: string, by: number) => {
  const { start } = parseMonth(key);
  return monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + by, 1)));
};

/** HR can't change a month once it's submitted or approved. Super Admins always can. */
export const isLocked = (status: string | null | undefined) => status === "SUBMITTED" || status === "APPROVED";
