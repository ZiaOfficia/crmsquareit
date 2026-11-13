import Link from "next/link";
import clsx from "clsx";
import { Cake, CalendarDays, PartyPopper } from "lucide-react";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Avatar, Badge, Card, EmptyState, btn } from "@/components/ui";
import { ATTENDANCE_STATUS, addDays, clockTime, dayKey, dbDate, dbKey, fmtDay, hhmm, monthOf, weekday } from "@/lib/hr";
import { holidaySet, hrConfig } from "@/lib/hr-server";
import { markAllPresent, quickMark } from "./actions";
import { Kpi, LeaveRow, leaveRange } from "./parts";

export default async function HrToday() {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const today = dayKey();
  const in30 = addDays(today, 30);
  const cfg = await hrConfig();

  const [staff, rows, pending, onLeave, holidays, payslips] = await Promise.all([
    db.staff.findMany({
      where: { active: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, designation: true, dob: true, joinDate: true, monthlySalary: true, orgMemberships: { select: { department: { select: { name: true } } }, take: 1 } },
    }),
    db.attendance.findMany({ where: { date: dbDate(today) } }),
    db.leaveRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { fromDate: "asc" },
      include: { staff: { select: { firstName: true, lastName: true, designation: true } } },
    }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", toDate: { gte: dbDate(today) }, fromDate: { lte: dbDate(addDays(today, 7)) } },
      orderBy: { fromDate: "asc" },
      include: { staff: { select: { firstName: true, lastName: true } } },
    }),
    db.holiday.findMany({ where: { date: { gte: dbDate(today), lte: dbDate(addDays(today, 60)) } }, orderBy: { date: "asc" } }),
    db.payslip.groupBy({ by: ["status"], where: { month: monthOf(addDays(`${monthOf(today)}-01`, -1)) }, _count: true }),
  ]);
  const byStaff = new Map(rows.map((r) => [r.staffId, r]));
  const isOff = cfg.weeklyOff.has(weekday(today)) || (await holidaySet(today, today)).has(today);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const late = rows.filter((r) => r.checkIn && hhmm(r.checkIn) > cfg.workStart).length;
  const notIn = staff.filter((s) => !byStaff.has(s.id)).length;
  const lastMonth = monthOf(addDays(`${monthOf(today)}-01`, -1));
  const paid = payslips.find((p) => p.status === "PAID")?._count ?? 0;
  const draft = payslips.find((p) => p.status === "DRAFT")?._count ?? 0;

  // Birthdays and work anniversaries in the next 30 days.
  const upcoming = staff
    .flatMap((s) => {
      const out: { s: typeof s; kind: "birthday" | "anniversary"; key: string; years?: number }[] = [];
      for (const [kind, d] of [["birthday", s.dob], ["anniversary", s.joinDate]] as const) {
        if (!d) continue;
        const md = dbKey(d).slice(5);
        let key = `${today.slice(0, 4)}-${md}`;
        if (key < today) key = `${Number(today.slice(0, 4)) + 1}-${md}`;
        const years = Number(key.slice(0, 4)) - Number(dbKey(d).slice(0, 4));
        if (key <= in30 && (kind === "birthday" || years > 0)) out.push({ s, kind, key, years });
      }
      return out;
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Employees" value={staff.length} sub="active" />
        <Kpi label="Present today" value={count("PRESENT") + count("WFH")} sub={`${count("WFH")} working from home`} tone="green" />
        <Kpi label="Late today" value={late} sub={`after ${cfg.workStart}`} tone={late ? "amber" : undefined} />
        <Kpi label="On leave" value={count("LEAVE")} sub={`${count("HALF_DAY")} half day`} tone="blue" />
        <Kpi label="Not marked" value={isOff ? "—" : notIn} sub={isOff ? "Weekly off / holiday" : `${count("ABSENT")} marked absent`} tone={!isOff && notIn ? "red" : undefined} />
        <Kpi label="Leave requests" value={pending.length} sub="waiting for approval" tone={pending.length ? "amber" : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={`Attendance · ${fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}`}
          actions={
            canEdit && notIn > 0 && !isOff ? (
              <form action={markAllPresent}>
                <input type="hidden" name="date" value={today} />
                <button className={btn("secondary", "px-2.5 py-1 text-xs")}>Mark the rest present</button>
              </form>
            ) : (
              <Link href="/admin/hr/attendance" className="link text-xs">Monthly register</Link>
            )
          }
        >
          {isOff && <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-500">Today is a weekly off or holiday.</p>}
          <ul className="divide-y divide-slate-100">
            {staff.map((s) => {
              const r = byStaff.get(s.id);
              const st = r ? ATTENDANCE_STATUS[r.status] : null;
              const isLate = r?.checkIn && hhmm(r.checkIn) > cfg.workStart;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <Avatar name={`${s.firstName} ${s.lastName}`} size={30} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/hr/employees/${s.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-primary">
                      {s.firstName} {s.lastName}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{[s.designation, s.orgMemberships[0]?.department.name].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {r?.checkIn && (
                      <span className={clsx(isLate && "font-semibold text-amber-700")}>
                        In {clockTime(r.checkIn)}
                        {isLate && " · late"}
                      </span>
                    )}
                    {r?.checkOut && <span> · Out {clockTime(r.checkOut)}</span>}
                    {r?.note && !r.checkIn && <span>{r.note}</span>}
                  </div>
                  {st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone="gray">Not marked</Badge>}
                  {canEdit && (
                    <form action={quickMark} className="flex gap-1">
                      <input type="hidden" name="staffId" value={s.id} />
                      <input type="hidden" name="date" value={today} />
                      {(["PRESENT", "HALF_DAY", "ABSENT"] as const)
                        .filter((k) => r?.status !== k)
                        .map((k) => (
                          <button key={k} name="status" value={k} title={`Mark ${ATTENDANCE_STATUS[k].label.toLowerCase()}`} className={clsx("h-7 w-7 rounded-md text-xs font-bold", ATTENDANCE_STATUS[k].cell, "opacity-70 hover:opacity-100")}>
                            {ATTENDANCE_STATUS[k].short}
                          </button>
                        ))}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Leave requests" actions={<Link href="/admin/hr/leave" className="link text-xs">All leave</Link>}>
            {pending.length === 0 ? (
              <EmptyState title="Nothing to approve" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.slice(0, 6).map((l) => (
                  <LeaveRow key={l.id} l={l} review={canEdit} />
                ))}
              </ul>
            )}
          </Card>

          <Card title="On leave this week">
            {onLeave.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">Nobody.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {onLeave.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-700">{l.staff.firstName} {l.staff.lastName}</span>
                    <span className="text-xs text-slate-500">{leaveRange(l)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Coming up">
            {upcoming.length === 0 && holidays.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No birthdays, anniversaries or holidays soon. Add dates of birth and joining in Employees.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[
                  ...holidays.map((h) => ({ key: dbKey(h.date), icon: CalendarDays, text: h.name, sub: "Holiday", color: "text-primary" })),
                  ...upcoming.map((u) => ({
                    key: u.key,
                    icon: u.kind === "birthday" ? Cake : PartyPopper,
                    text: `${u.s.firstName} ${u.s.lastName}`,
                    sub: u.kind === "birthday" ? "Birthday" : `${u.years} year${u.years === 1 ? "" : "s"} at work`,
                    color: u.kind === "birthday" ? "text-pink-600" : "text-amber-600",
                  })),
                ]
                  .sort((a, b) => a.key.localeCompare(b.key))
                  .slice(0, 10)
                  .map((x, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <x.icon className={clsx("h-4 w-4 shrink-0", x.color)} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-slate-700">{x.text}</span> <span className="text-xs text-slate-500">· {x.sub}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{x.key === today ? "Today" : fmtDay(x.key, { day: "numeric", month: "short" })}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card title="Payroll" actions={<Link href={`/admin/hr/payroll?month=${lastMonth}`} className="link text-xs">Open</Link>}>
            <p className="px-5 py-4 text-sm text-slate-600">
              {paid + draft === 0 ? (
                <>Last month's payroll hasn't been generated yet.</>
              ) : (
                <>
                  Last month: <span className="font-semibold text-brand-green">{paid} paid</span>
                  {draft > 0 && <>, <span className="font-semibold text-amber-600">{draft} still to pay</span></>}.
                </>
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
