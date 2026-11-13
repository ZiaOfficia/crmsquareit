"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { saveSettings } from "@/lib/settings";
import { num, str, type ActionState } from "@/lib/forms";
import { ATTENDANCE_STATUS, LEAVE_TYPES, dayKey, dbDate, dbKey, isDayKey, isMonthKey, monthLabel, round2, workingDays } from "@/lib/hr";
import { computePay, holidaySet, hrConfig, leaveBalances } from "@/lib/hr-server";

const refresh = () => {
  revalidatePath("/admin/hr", "layout");
  revalidatePath("/admin/my");
};

/* ───────────── Self service: check in / out ───────────── */

export async function checkIn() {
  const user = await requireUser();
  const date = dbDate(dayKey());
  const row = await db.attendance.findUnique({ where: { staffId_date: { staffId: user.id, date } } });
  if (row?.checkIn) return;
  // Someone on approved leave who still comes in is marked present.
  await db.attendance.upsert({
    where: { staffId_date: { staffId: user.id, date } },
    create: { staffId: user.id, date, status: "PRESENT", checkIn: new Date() },
    update: { checkIn: new Date(), status: row?.status === "WFH" ? "WFH" : "PRESENT" },
  });
  refresh();
}

export async function checkInWfh() {
  const user = await requireUser();
  const date = dbDate(dayKey());
  await db.attendance.upsert({
    where: { staffId_date: { staffId: user.id, date } },
    create: { staffId: user.id, date, status: "WFH", checkIn: new Date() },
    update: { status: "WFH", checkIn: new Date() },
  });
  refresh();
}

export async function checkOut() {
  const user = await requireUser();
  const date = dbDate(dayKey());
  const row = await db.attendance.findUnique({ where: { staffId_date: { staffId: user.id, date } } });
  if (!row?.checkIn) return;
  await db.attendance.update({ where: { id: row.id }, data: { checkOut: new Date() } });
  refresh();
}

/* ───────────── HR: attendance ───────────── */

export async function markAttendance(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("hr", "edit");
  const staffId = Number(f.get("staffId"));
  const key = String(f.get("date") ?? "");
  const status = String(f.get("status") ?? "");
  if (!staffId) return { error: "Pick a person." };
  if (!isDayKey(key)) return { error: "Pick a date." };
  const date = dbDate(key);
  if (status === "CLEAR") {
    await db.attendance.deleteMany({ where: { staffId, date } });
  } else {
    if (!ATTENDANCE_STATUS[status]) return { error: "Pick a status." };
    const note = str(f, "note");
    await db.attendance.upsert({
      where: { staffId_date: { staffId, date } },
      create: { staffId, date, status, note, markedById: user.id },
      update: { status, note, markedById: user.id },
    });
  }
  refresh();
  return { ok: true };
}

/** Quick buttons on the "today" board. */
export async function quickMark(f: FormData) {
  const user = await requirePerm("hr", "edit");
  const staffId = Number(f.get("staffId"));
  const key = String(f.get("date") ?? dayKey());
  const status = String(f.get("status"));
  if (!staffId || !isDayKey(key) || !ATTENDANCE_STATUS[status]) return;
  const date = dbDate(key);
  await db.attendance.upsert({
    where: { staffId_date: { staffId, date } },
    create: { staffId, date, status, markedById: user.id },
    update: { status, markedById: user.id },
  });
  refresh();
}

/** Mark everyone without an entry for the day as present. */
export async function markAllPresent(f: FormData) {
  const user = await requirePerm("hr", "edit");
  const key = String(f.get("date") ?? dayKey());
  if (!isDayKey(key)) return;
  const date = dbDate(key);
  const [staff, existing] = await Promise.all([
    db.staff.findMany({ where: { active: true }, select: { id: true } }),
    db.attendance.findMany({ where: { date }, select: { staffId: true } }),
  ]);
  const has = new Set(existing.map((e) => e.staffId));
  const data = staff.filter((s) => !has.has(s.id)).map((s) => ({ staffId: s.id, date, status: "PRESENT", markedById: user.id }));
  if (data.length) await db.attendance.createMany({ data, skipDuplicates: true });
  refresh();
}

/* ───────────── Leave ───────────── */

export async function applyLeave(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  // HR can file leave for someone else (e.g. a phoned-in sick day); everyone else files their own.
  const forId = Number(f.get("staffId") || 0);
  const staffId = forId && forId !== user.id && can(user, "hr", "create") ? forId : user.id;
  const type = String(f.get("type") ?? "");
  const from = String(f.get("fromDate") ?? "");
  const to = String(f.get("toDate") || from);
  const halfDay = f.get("halfDay") === "on";
  if (!LEAVE_TYPES[type]) return { error: "Pick a leave type." };
  if (!isDayKey(from) || !isDayKey(to)) return { error: "Pick the dates." };
  if (to < from) return { error: "The end date is before the start date." };
  if (halfDay && from !== to) return { error: "A half day must be a single date." };
  const cfg = await hrConfig();
  const days = workingDays(from, to, cfg.weeklyOff, await holidaySet(from, to));
  if (!days.length) return { error: "Those dates are all weekly offs or holidays." };
  const count = halfDay ? 0.5 : days.length;
  const clash = await db.leaveRequest.findFirst({
    where: { staffId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: dbDate(to) }, toDate: { gte: dbDate(from) } },
  });
  if (clash) return { error: "There is already a leave request for some of these dates." };
  if (type !== "UNPAID") {
    const bal = (await leaveBalances([staffId], Number(from.slice(0, 4)), cfg.quota))[staffId][type];
    if (count > bal.left - bal.pending)
      return { error: `Only ${Math.max(0, bal.left - bal.pending)} day(s) of ${LEAVE_TYPES[type].label.toLowerCase()} left. Apply the rest as unpaid leave.` };
  }
  const req = await db.leaveRequest.create({
    data: { staffId, type, fromDate: dbDate(from), toDate: dbDate(to), halfDay, days: count, reason: str(f, "reason") },
  });
  // Filed by HR → approved straight away.
  if (staffId !== user.id) await approve(req.id, user.id, null);
  await logActivity("staff", staffId, `applied for ${count} day(s) of ${LEAVE_TYPES[type].label.toLowerCase()}`, user.id);
  refresh();
  return { ok: true };
}

async function approve(id: number, reviewerId: number, note: string | null) {
  const req = await db.leaveRequest.update({ where: { id }, data: { status: "APPROVED", reviewedById: reviewerId, reviewNote: note, reviewedAt: new Date() } });
  const from = dbKey(req.fromDate);
  const to = dbKey(req.toDate);
  const cfg = await hrConfig();
  const days = workingDays(from, to, cfg.weeklyOff, await holidaySet(from, to));
  const status = req.type === "UNPAID" && req.halfDay ? "HALF_DAY" : "LEAVE";
  const label = `${LEAVE_TYPES[req.type].label}${req.halfDay ? " (half day)" : ""}`;
  for (const k of days)
    await db.attendance.upsert({
      where: { staffId_date: { staffId: req.staffId, date: dbDate(k) } },
      create: { staffId: req.staffId, date: dbDate(k), status, note: label, markedById: reviewerId },
      update: { status, note: label, markedById: reviewerId },
    });
}

export async function reviewLeave(f: FormData) {
  const user = await requirePerm("hr", "edit");
  const id = Number(f.get("id"));
  const decision = String(f.get("decision"));
  const note = str(f, "note");
  const req = await db.leaveRequest.findUnique({ where: { id }, include: { staff: { select: { firstName: true, lastName: true } } } });
  if (!req || req.status !== "PENDING") return;
  if (decision === "APPROVE") await approve(id, user.id, note);
  else await db.leaveRequest.update({ where: { id }, data: { status: "REJECTED", reviewedById: user.id, reviewNote: note, reviewedAt: new Date() } });
  await logActivity("staff", req.staffId, `${decision === "APPROVE" ? "approved" : "rejected"} leave for ${req.staff.firstName} ${req.staff.lastName}`, user.id);
  refresh();
}

/** The person can cancel their own pending request; HR can cancel any (and approved leave is removed from attendance). */
export async function cancelLeave(f: FormData) {
  const user = await requireUser();
  const id = Number(f.get("id"));
  const req = await db.leaveRequest.findUnique({ where: { id } });
  if (!req) return;
  const isHr = can(user, "hr", "edit");
  if (!isHr && (req.staffId !== user.id || req.status !== "PENDING")) return;
  if (req.status === "APPROVED")
    await db.attendance.deleteMany({ where: { staffId: req.staffId, status: { in: ["LEAVE", "HALF_DAY"] }, date: { gte: req.fromDate, lte: req.toDate }, checkIn: null } });
  await db.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  refresh();
}

/* ───────────── Holidays ───────────── */

export async function saveHoliday(_: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("hr", "edit");
  const key = String(f.get("date") ?? "");
  const name = str(f, "name");
  if (!isDayKey(key) || !name) return { error: "Enter a date and a name." };
  await db.holiday.upsert({ where: { date: dbDate(key) }, create: { date: dbDate(key), name }, update: { name } });
  refresh();
  return { ok: true };
}

export async function deleteHoliday(f: FormData) {
  await requirePerm("hr", "edit");
  await db.holiday.delete({ where: { id: Number(f.get("id")) } });
  refresh();
}

/* ───────────── Employee HR record ───────────── */

export async function saveEmployee(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const user = await requirePerm("hr", "edit");
  const date = (k: string) => {
    const v = String(f.get(k) ?? "");
    return isDayKey(v) ? dbDate(v) : null;
  };
  const code = str(f, "employeeCode");
  if (code) {
    const taken = await db.staff.findFirst({ where: { employeeCode: code, id: { not: id } }, select: { firstName: true } });
    if (taken) return { error: `Employee code ${code} is already used by ${taken.firstName}.` };
  }
  await db.staff.update({
    where: { id },
    data: {
      employeeCode: code,
      designation: str(f, "designation"),
      joinDate: date("joinDate"),
      dob: date("dob"),
      gender: str(f, "gender"),
      phone: str(f, "phone"),
      address: str(f, "address"),
      emergencyName: str(f, "emergencyName"),
      emergencyPhone: str(f, "emergencyPhone"),
      bankName: str(f, "bankName"),
      bankAccount: str(f, "bankAccount"),
      bankIfsc: str(f, "bankIfsc"),
      pan: str(f, "pan"),
      monthlySalary: Math.max(0, num(f, "monthlySalary")),
    },
  });
  await logActivity("staff", id, "updated HR record", user.id);
  refresh();
  return { ok: true };
}

/* ───────────── Payroll ───────────── */

export async function generatePayroll(f: FormData) {
  const user = await requirePerm("hr", "create");
  const month = String(f.get("month"));
  if (!isMonthKey(month)) return;
  const cfg = await hrConfig();
  const staff = await db.staff.findMany({ where: { active: true, monthlySalary: { gt: 0 } }, select: { id: true, monthlySalary: true } });
  const existing = await db.payslip.findMany({ where: { month } });
  const byStaff = new Map(existing.map((p) => [p.staffId, p]));
  for (const s of staff) {
    const old = byStaff.get(s.id);
    if (old?.status === "PAID") continue; // never touch a paid slip
    const pay = await computePay(s.id, s.monthlySalary, month, cfg.weeklyOff);
    const bonus = old?.bonus ?? 0;
    const deduction = old?.deduction ?? 0;
    const data = { salary: s.monthlySalary, workingDays: pay.workingDays, lopDays: pay.lopDays, lopAmount: pay.lopAmount, bonus, deduction, net: round2(pay.base + bonus - deduction) };
    await db.payslip.upsert({ where: { staffId_month: { staffId: s.id, month } }, create: { staffId: s.id, month, ...data }, update: data });
  }
  await logActivity("payroll", 0, `generated payroll for ${monthLabel(month)}`, user.id);
  refresh();
}

export async function updatePayslip(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("hr", "edit");
  const p = await db.payslip.findUnique({ where: { id } });
  if (!p) return { error: "Payslip not found." };
  if (p.status === "PAID") return { error: "This payslip is already paid. Mark it unpaid to change it." };
  const bonus = Math.max(0, num(f, "bonus"));
  const deduction = Math.max(0, num(f, "deduction"));
  await db.payslip.update({ where: { id }, data: { bonus, deduction, note: str(f, "note"), net: round2(p.salary - p.lopAmount + bonus - deduction) } });
  refresh();
  return { ok: true };
}

export async function setPayslipPaid(f: FormData) {
  const user = await requirePerm("hr", "edit");
  const paid = f.get("paid") === "1";
  const id = Number(f.get("id") || 0);
  const month = String(f.get("month") ?? "");
  const where = id ? { id } : isMonthKey(month) ? { month, status: paid ? "DRAFT" : "PAID" } : null;
  if (!where) return;
  await db.payslip.updateMany({ where, data: { status: paid ? "PAID" : "DRAFT", paidAt: paid ? new Date() : null } });
  await logActivity("payroll", id, `${paid ? "marked paid" : "marked unpaid"} ${id ? "a payslip" : `payroll for ${monthLabel(month)}`}`, user.id);
  refresh();
}

/* ───────────── Settings ───────────── */

export async function saveHrSettings(_: ActionState, f: FormData): Promise<ActionState> {
  await requirePerm("hr", "edit");
  const n = (k: string) => String(Math.max(0, Math.round(num(f, k) * 2) / 2));
  const start = String(f.get("hr_work_start") ?? "10:00");
  if (!/^\d{2}:\d{2}$/.test(start)) return { error: "Enter the start time as HH:MM." };
  await saveSettings({
    hr_leave_casual: n("hr_leave_casual"),
    hr_leave_sick: n("hr_leave_sick"),
    hr_leave_earned: n("hr_leave_earned"),
    hr_work_start: start,
    hr_weekly_off: f.getAll("hr_weekly_off").map(String).filter((d) => /^[0-6]$/.test(d)).join(","),
  });
  refresh();
  return { ok: true };
}
