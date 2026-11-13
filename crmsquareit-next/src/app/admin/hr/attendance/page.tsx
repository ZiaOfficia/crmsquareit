import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";
import { ATTENDANCE_STATUS, dayKey, daysOfMonth, dbDate, dbKey, isDayKey, isMonthKey, monthLabel, monthOf, shiftMonthKey, weekday } from "@/lib/hr";
import { holidaySet, hrConfig } from "@/lib/hr-server";
import { markAttendance } from "../actions";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const sp = await searchParams;
  const today = dayKey();
  const month = isMonthKey(sp.month) ? sp.month : monthOf(today);
  const days = daysOfMonth(month);
  const cfg = await hrConfig();
  const [staff, rows, holidays] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    db.attendance.findMany({ where: { date: { gte: dbDate(days[0]), lte: dbDate(days[days.length - 1]) } } }),
    holidaySet(days[0], days[days.length - 1]),
  ]);
  const cell = new Map(rows.map((r) => [`${r.staffId}:${dbKey(r.date)}`, r]));
  const isOff = (k: string) => cfg.weeklyOff.has(weekday(k)) || holidays.has(k);
  const selStaff = Number(sp.staffId) || staff[0]?.id;
  const selDate = isDayKey(sp.date) ? sp.date : today <= days[days.length - 1] && today >= days[0] ? today : days[0];
  const sel = cell.get(`${selStaff}:${selDate}`);
  const href = (p: Record<string, string>) => `?${new URLSearchParams({ month, ...p })}`;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card title="Mark attendance">
          <ActionForm key={`${selStaff}:${selDate}`} action={markAttendance} savedText="Saved." className="grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <span className="label">Employee</span>
              <select name="staffId" className="input" defaultValue={selStaff}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Date</span>
              <input type="date" name="date" className="input" defaultValue={selDate} />
            </div>
            <div>
              <span className="label">Status</span>
              <select name="status" className="input" defaultValue={sel?.status ?? "PRESENT"}>
                {Object.entries(ATTENDANCE_STATUS).map(([k, s]) => (
                  <option key={k} value={k}>{s.label}</option>
                ))}
                <option value="CLEAR">— Clear entry</option>
              </select>
            </div>
            <div>
              <span className="label">Note</span>
              <input name="note" className="input" defaultValue={sel?.note ?? ""} placeholder="Optional" />
            </div>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">Tip: click any cell in the register to load it here.</p>
        </Card>
      )}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Link href={href({ month: shiftMonthKey(month, -1) })} className="rounded p-1 hover:bg-slate-100" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {monthLabel(month)}
            <Link href={href({ month: shiftMonthKey(month, 1) })} className="rounded p-1 hover:bg-slate-100" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </span>
        }
        actions={
          <div className="hidden flex-wrap gap-2 text-[11px] text-slate-500 md:flex">
            {Object.values(ATTENDANCE_STATUS).map((s) => (
              <span key={s.short} className="flex items-center gap-1">
                <span className={clsx("inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold", s.cell)}>{s.short}</span>
                {s.label}
              </span>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold">Employee</th>
                {days.map((k) => (
                  <th key={k} className={clsx("min-w-[26px] px-0.5 py-2 text-center font-medium", isOff(k) && "text-slate-300", k === today && "text-primary")}>
                    <div>{Number(k.slice(8))}</div>
                    <div className="text-[9px] font-normal">{"SMTWTFS"[weekday(k)]}</div>
                  </th>
                ))}
                {["P", "L", "H", "A"].map((h) => (
                  <th key={h} className="px-2 py-2 text-center font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => {
                const tally = { P: 0, L: 0, H: 0, A: 0 };
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-slate-700">
                      <Link href={`/admin/hr/employees/${s.id}`} className="hover:text-primary">{s.firstName} {s.lastName}</Link>
                    </td>
                    {days.map((k) => {
                      const r = cell.get(`${s.id}:${k}`);
                      const st = r ? ATTENDANCE_STATUS[r.status] : null;
                      if (r?.status === "PRESENT" || r?.status === "WFH") tally.P++;
                      else if (r?.status === "LEAVE") tally.L++;
                      else if (r?.status === "HALF_DAY") tally.H++;
                      else if (r?.status === "ABSENT") tally.A++;
                      const content = st ? st.short : isOff(k) ? "·" : "";
                      const cls = clsx(
                        "mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
                        st ? st.cell : isOff(k) ? "text-slate-300" : k < today ? "bg-slate-50 text-slate-300" : "",
                        k === selDate && s.id === selStaff && canEdit && "ring-2 ring-primary"
                      );
                      return (
                        <td key={k} className="px-0.5 py-1 text-center" title={r?.note ?? (isOff(k) ? (holidays.has(k) ? "Holiday" : "Weekly off") : undefined)}>
                          {canEdit ? (
                            <Link href={href({ staffId: String(s.id), date: k })} scroll={false} className={cls}>
                              {content}
                            </Link>
                          ) : (
                            <span className={cls}>{content}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-semibold text-green-700">{tally.P}</td>
                    <td className="px-2 text-center font-semibold text-purple-700">{tally.L}</td>
                    <td className="px-2 text-center font-semibold text-amber-700">{tally.H}</td>
                    <td className="px-2 text-center font-semibold text-red-700">{tally.A}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          Unmarked working days count as paid in payroll. Only Absent, Half day and unpaid leave reduce salary.
        </p>
      </Card>
    </div>
  );
}
