import type { Tone } from "./constants";

/**
 * HR portal helpers that don't touch the database.
 * Days are handled as "YYYY-MM-DD" keys in India time and stored in @db.Date columns
 * (UTC midnight), so a day never shifts because of the server's time zone.
 */
export const HR_TZ = "Asia/Kolkata";

export const ATTENDANCE_STATUS: Record<string, { label: string; short: string; tone: Tone; cell: string }> = {
  PRESENT: { label: "Present", short: "P", tone: "green", cell: "bg-green-100 text-green-800" },
  WFH: { label: "Work from home", short: "W", tone: "blue", cell: "bg-blue-100 text-blue-800" },
  HALF_DAY: { label: "Half day", short: "H", tone: "amber", cell: "bg-amber-100 text-amber-800" },
  LEAVE: { label: "On leave", short: "L", tone: "purple", cell: "bg-purple-100 text-purple-800" },
  ABSENT: { label: "Absent", short: "A", tone: "red", cell: "bg-red-100 text-red-700" },
};

export const LEAVE_TYPES: Record<string, { label: string; setting?: "hr_leave_casual" | "hr_leave_sick" | "hr_leave_earned" }> = {
  CASUAL: { label: "Casual leave", setting: "hr_leave_casual" },
  SICK: { label: "Sick leave", setting: "hr_leave_sick" },
  EARNED: { label: "Earned leave", setting: "hr_leave_earned" },
  UNPAID: { label: "Unpaid leave" },
};

export const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

export const PAYSLIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  PAID: { label: "Paid", tone: "green" },
};

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: HR_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: HR_TZ, hour: "2-digit", minute: "2-digit", hour12: true });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: HR_TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** "YYYY-MM-DD" for an instant, in India time. */
export const dayKey = (d: Date = new Date()) => keyFmt.format(d);
/** "YYYY-MM-DD" for a value read from a @db.Date column. */
export const dbKey = (d: Date) => d.toISOString().slice(0, 10);
/** The value to store in a @db.Date column for a day key. */
export const dbDate = (key: string) => new Date(`${key}T00:00:00Z`);
export const isDayKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(dbDate(v).getTime());
export const weekday = (key: string) => dbDate(key).getUTCDay();
export const addDays = (key: string, n: number) => dbKey(new Date(dbDate(key).getTime() + n * 86_400_000));
export const clockTime = (d: Date) => timeFmt.format(d);
/** "HH:MM" (24h) in India time, to compare with the work start time. */
export const hhmm = (d: Date) => hmFmt.format(d);
export const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  dbDate(key).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

/** "YYYY-MM" helpers. */
export const monthOf = (key: string) => key.slice(0, 7);
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function shiftMonthKey(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const monthLabel = (m: string) => dbDate(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export function daysOfMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`);
}

export const parseWeeklyOff = (v: string) =>
  new Set(
    v
      .split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => n >= 0 && n <= 6)
  );

/** Working days between two day keys (inclusive), skipping weekly offs and holidays. */
export function workingDays(from: string, to: string, weeklyOff: Set<number>, holidays: Set<string>) {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) if (!weeklyOff.has(weekday(k)) && !holidays.has(k)) out.push(k);
  return out;
}

/** Loss-of-pay days from one person's attendance rows + approved unpaid leave in a month. */
export function lopFor(rows: { date: Date; status: string }[], unpaidLeaveDays: Set<string>) {
  let lop = 0;
  for (const r of rows) {
    const k = dbKey(r.date);
    if (r.status === "ABSENT") lop += 1;
    else if (r.status === "HALF_DAY") lop += 0.5;
    else if (r.status === "LEAVE" && unpaidLeaveDays.has(k)) lop += 1;
  }
  return lop;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
