import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { LEAVE_TYPES, daysOfMonth, dbDate, dbKey, lopFor, parseWeeklyOff, round2, workingDays } from "./hr";

export async function hrConfig() {
  const s = await getSettings();
  return {
    currency: s.currency,
    workStart: /^\d{2}:\d{2}$/.test(s.hr_work_start) ? s.hr_work_start : "10:00",
    weeklyOff: parseWeeklyOff(s.hr_weekly_off),
    quota: {
      CASUAL: Number(s.hr_leave_casual) || 0,
      SICK: Number(s.hr_leave_sick) || 0,
      EARNED: Number(s.hr_leave_earned) || 0,
      UNPAID: Infinity,
    } as Record<string, number>,
    settings: s,
  };
}

export async function holidaySet(from: string, to: string) {
  const rows = await db.holiday.findMany({ where: { date: { gte: dbDate(from), lte: dbDate(to) } } });
  return new Set(rows.map((h) => dbKey(h.date)));
}

/** Leave used and left this calendar year, per type. Pending requests are shown separately. */
export async function leaveBalances(staffIds: number[], year: number, quota: Record<string, number>) {
  const rows = await db.leaveRequest.groupBy({
    by: ["staffId", "type", "status"],
    where: { staffId: { in: staffIds }, status: { in: ["APPROVED", "PENDING"] }, fromDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } },
    _sum: { days: true },
  });
  const out: Record<number, Record<string, { quota: number; used: number; pending: number; left: number }>> = {};
  for (const id of staffIds)
    out[id] = Object.fromEntries(Object.keys(LEAVE_TYPES).map((t) => [t, { quota: quota[t], used: 0, pending: 0, left: quota[t] }]));
  for (const r of rows) {
    const b = out[r.staffId][r.type];
    if (!b) continue;
    if (r.status === "APPROVED") b.used += r._sum.days ?? 0;
    else b.pending += r._sum.days ?? 0;
  }
  for (const id of staffIds) for (const b of Object.values(out[id])) b.left = b.quota === Infinity ? Infinity : Math.max(0, b.quota - b.used);
  return out;
}

/** Salary for one person for a month: monthly salary minus loss-of-pay days. Unmarked days count as paid. */
export async function computePay(staffId: number, salary: number, month: string, weeklyOff: Set<number>) {
  const days = daysOfMonth(month);
  const from = days[0];
  const to = days[days.length - 1];
  const holidays = await holidaySet(from, to);
  const work = workingDays(from, to, weeklyOff, holidays);
  const [rows, unpaid] = await Promise.all([
    db.attendance.findMany({ where: { staffId, date: { gte: dbDate(from), lte: dbDate(to) } }, select: { date: true, status: true } }),
    db.leaveRequest.findMany({ where: { staffId, type: "UNPAID", status: "APPROVED", fromDate: { lte: dbDate(to) }, toDate: { gte: dbDate(from) } }, select: { fromDate: true, toDate: true } }),
  ]);
  const unpaidDays = new Set<string>();
  for (const l of unpaid) for (const k of workingDays(dbKey(l.fromDate), dbKey(l.toDate), weeklyOff, holidays)) unpaidDays.add(k);
  const workSet = new Set(work);
  const lopDays = lopFor(rows.filter((r) => workSet.has(dbKey(r.date))), unpaidDays);
  const perDay = work.length ? salary / work.length : 0;
  const lopAmount = round2(Math.min(salary, perDay * lopDays));
  return { workingDays: work.length, lopDays, lopAmount, base: round2(salary - lopAmount) };
}
