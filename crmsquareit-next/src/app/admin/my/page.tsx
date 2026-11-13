import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Home, LogIn, LogOut } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { Card, PageHeader, StatusBadge, btn } from "@/components/ui";
import { ATTENDANCE_STATUS, LEAVE_TYPES, PAYSLIP_STATUS, clockTime, dayKey, daysOfMonth, dbDate, dbKey, fmtDay, hhmm, isMonthKey, monthLabel, monthOf, shiftMonthKey, weekday } from "@/lib/hr";
import { holidaySet, hrConfig, leaveBalances } from "@/lib/hr-server";
import { checkIn, checkInWfh, checkOut } from "../hr/actions";
import { LeaveForm, LeaveRow } from "../hr/parts";

export const metadata = { title: "My HR" };

export default async function MyHrPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = dayKey();
  const month = isMonthKey(sp.month) ? sp.month : monthOf(today);
  const days = daysOfMonth(month);
  const cfg = await hrConfig();
  const [me, todayRow, rows, leaves, slips, holidays, upcomingHolidays, balances] = await Promise.all([
    db.staff.findUnique({ where: { id: user.id }, select: { designation: true, employeeCode: true } }),
    db.attendance.findUnique({ where: { staffId_date: { staffId: user.id, date: dbDate(today) } } }),
    db.attendance.findMany({ where: { staffId: user.id, date: { gte: dbDate(days[0]), lte: dbDate(days[days.length - 1]) } } }),
    db.leaveRequest.findMany({ where: { staffId: user.id }, orderBy: { fromDate: "desc" }, take: 10, include: { reviewedBy: { select: { firstName: true } } } }),
    db.payslip.findMany({ where: { staffId: user.id, status: "PAID" }, orderBy: { month: "desc" }, take: 12 }),
    holidaySet(days[0], days[days.length - 1]),
    db.holiday.findMany({ where: { date: { gte: dbDate(today) } }, orderBy: { date: "asc" }, take: 5 }),
    leaveBalances([user.id], Number(today.slice(0, 4)), cfg.quota),
  ]);
  const byDay = new Map(rows.map((r) => [dbKey(r.date), r]));
  const bal = balances[user.id];
  const lead = weekday(days[0]); // blank cells before day 1 (Sunday-first grid)
  const tally = (s: string) => rows.filter((r) => r.status === s).length;
  const late = todayRow?.checkIn && hhmm(todayRow.checkIn) > cfg.workStart;
  const offToday = cfg.weeklyOff.has(weekday(today));

  return (
    <>
      <PageHeader title="My HR" subtitle={[me?.designation, me?.employeeCode].filter(Boolean).join(" · ") || "Attendance, leave and payslips"} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}</p>
                {todayRow?.checkIn ? (
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {todayRow.status === "WFH" ? "Working from home" : "Checked in"} at {clockTime(todayRow.checkIn)}
                    {late && <span className="ml-2 text-sm font-medium text-amber-600">late (after {cfg.workStart})</span>}
                    {todayRow.checkOut && <span className="block text-sm font-normal text-slate-500">Checked out at {clockTime(todayRow.checkOut)}</span>}
                  </p>
                ) : todayRow ? (
                  <p className="mt-1 text-lg font-semibold text-ink">Marked {ATTENDANCE_STATUS[todayRow.status]?.label.toLowerCase()} {todayRow.note && <span className="text-sm font-normal text-slate-500">· {todayRow.note}</span>}</p>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-ink">{offToday ? "It's your weekly off." : "You haven't checked in yet."}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!todayRow?.checkIn && (
                  <>
                    <form action={checkIn}>
                      <button className={btn("success")}>
                        <LogIn className="h-4 w-4" /> Check in
                      </button>
                    </form>
                    <form action={checkInWfh}>
                      <button className={btn("secondary")}>
                        <Home className="h-4 w-4" /> Work from home
                      </button>
                    </form>
                  </>
                )}
                {todayRow?.checkIn && !todayRow.checkOut && (
                  <form action={checkOut}>
                    <button className={btn("secondary")}>
                      <LogOut className="h-4 w-4" /> Check out
                    </button>
                  </form>
                )}
              </div>
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Link href={`?month=${shiftMonthKey(month, -1)}`} className="rounded p-1 hover:bg-slate-100" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                {monthLabel(month)}
                <Link href={`?month=${shiftMonthKey(month, 1)}`} className="rounded p-1 hover:bg-slate-100" aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </span>
            }
            actions={
              <span className="text-xs text-slate-500">
                {tally("PRESENT") + tally("WFH")} present · {tally("LEAVE")} leave · {tally("HALF_DAY")} half · {tally("ABSENT")} absent
              </span>
            }
          >
            <div className="grid grid-cols-7 gap-1.5 p-4 text-center text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="pb-1 font-semibold text-slate-400">{d}</div>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {days.map((k) => {
                const r = byDay.get(k);
                const st = r ? ATTENDANCE_STATUS[r.status] : null;
                const off = cfg.weeklyOff.has(weekday(k)) || holidays.has(k);
                return (
                  <div
                    key={k}
                    title={r?.note ?? (holidays.has(k) ? "Holiday" : off ? "Weekly off" : undefined)}
                    className={clsx(
                      "flex aspect-square flex-col items-center justify-center rounded-lg",
                      st ? st.cell : off ? "bg-slate-50 text-slate-300" : "border border-slate-100 text-slate-500",
                      k === today && "ring-2 ring-primary"
                    )}
                  >
                    <span className="text-sm font-semibold">{Number(k.slice(8))}</span>
                    <span className="text-[9px]">{st ? st.label.split(" ")[0] : holidays.has(k) ? "Holiday" : ""}</span>
                    {r?.checkIn && <span className="hidden text-[9px] sm:block">{clockTime(r.checkIn)}</span>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="My leave">
            {leaves.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No leave requests yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leaves.map((l) => (
                  <LeaveRow key={l.id} l={l} cancel />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={`Leave balance · ${today.slice(0, 4)}`}>
            <div className="grid grid-cols-3 gap-2 p-4">
              {Object.entries(LEAVE_TYPES)
                .filter(([k]) => k !== "UNPAID")
                .map(([k, t]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-xl font-bold text-ink">{bal[k].left}</p>
                    <p className="text-[10px] text-slate-500">of {bal[k].quota}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-600">{t.label.replace(" leave", "")}</p>
                  </div>
                ))}
            </div>
          </Card>
          <Card title="Apply for leave">
            <LeaveForm balances={bal} />
          </Card>
          <Card title="Payslips">
            {slips.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">Your payslips appear here once salary is paid.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {slips.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <Link href={`/admin/payslip/${p.id}`} className="link">{monthLabel(p.month)}</Link>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{money(p.net, cfg.currency)}</span>
                      <StatusBadge map={PAYSLIP_STATUS} value={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Upcoming holidays">
            {upcomingHolidays.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">None added yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingHolidays.map((h) => (
                  <li key={h.id} className="flex justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-700">{h.name}</span>
                    <span className="text-xs text-slate-500">{fmtDay(dbKey(h.date), { weekday: "short", day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
