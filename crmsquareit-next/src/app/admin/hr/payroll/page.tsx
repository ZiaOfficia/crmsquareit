import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { money } from "@/lib/format";
import { Card, EmptyState, StatusBadge, btn } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";
import { PAYSLIP_STATUS, dayKey, isMonthKey, monthLabel, monthOf, shiftMonthKey } from "@/lib/hr";
import { hrConfig } from "@/lib/hr-server";
import { generatePayroll, setPayslipPaid, updatePayslip } from "../actions";
import { Kpi } from "../parts";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const sp = await searchParams;
  // Default to last month: that's the one being paid.
  const month = isMonthKey(sp.month) ? sp.month : shiftMonthKey(monthOf(dayKey()), -1);
  const cfg = await hrConfig();
  const cur = cfg.currency;
  const [slips, noSalary] = await Promise.all([
    db.payslip.findMany({
      where: { month },
      orderBy: { staff: { firstName: "asc" } },
      include: { staff: { select: { id: true, firstName: true, lastName: true, designation: true, employeeCode: true } } },
    }),
    db.staff.findMany({ where: { active: true, monthlySalary: { lte: 0 } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const sum = (f: (p: (typeof slips)[number]) => number) => slips.reduce((s, p) => s + f(p), 0);
  const draft = slips.filter((p) => p.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Link href={`?month=${shiftMonthKey(month, -1)}`} className="rounded p-1 hover:bg-slate-100" aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          {monthLabel(month)}
          <Link href={`?month=${shiftMonthKey(month, 1)}`} className="rounded p-1 hover:bg-slate-100" aria-label="Next month">
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "hr", "create") && (
            <form action={generatePayroll}>
              <input type="hidden" name="month" value={month} />
              <button className={btn(slips.length ? "secondary" : "primary")}>{slips.length ? "Recalculate from attendance" : "Generate payroll"}</button>
            </form>
          )}
          {canEdit && draft > 0 && (
            <form action={setPayslipPaid}>
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="paid" value="1" />
              <button className={btn("success")}>Mark all {draft} paid</button>
            </form>
          )}
        </div>
      </div>

      {slips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Gross salary" value={money(sum((p) => p.salary), cur)} sub={`${slips.length} employees`} />
          <Kpi label="Loss of pay" value={money(sum((p) => p.lopAmount), cur)} sub={`${sum((p) => p.lopDays)} day(s)`} tone="red" />
          <Kpi label="Net payable" value={money(sum((p) => p.net), cur)} sub="after bonus & deductions" tone="blue" />
          <Kpi label="Paid" value={`${slips.length - draft} / ${slips.length}`} sub={draft ? `${money(sum((p) => (p.status === "DRAFT" ? p.net : 0)), cur)} still to pay` : "All paid"} tone={draft ? "amber" : "green"} />
        </div>
      )}

      <Card>
        {slips.length === 0 ? (
          <EmptyState
            title={`No payroll for ${monthLabel(month)} yet`}
            text="Generate it to work out each person's pay from their monthly salary and attendance. Set salaries in Employees."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Employee", "Salary", "Working days", "Loss of pay", "Bonus / deduction", "Net pay", "Status", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/hr/employees/${p.staff.id}`} className="font-medium text-slate-800 hover:text-primary">
                        {p.staff.firstName} {p.staff.lastName}
                      </Link>
                      <div className="text-xs text-slate-500">{[p.staff.employeeCode, p.staff.designation].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{money(p.salary, cur)}</td>
                    <td className="px-4 py-3 tabular-nums">{p.workingDays}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {p.lopDays ? (
                        <>
                          <span className="text-brand-red">−{money(p.lopAmount, cur)}</span>
                          <div className="text-xs text-slate-500">{p.lopDays} day(s)</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && p.status === "DRAFT" ? (
                        <ActionForm action={updatePayslip.bind(null, p.id)} className="flex flex-wrap items-center gap-1.5">
                          <input name="bonus" type="number" min="0" step="0.01" defaultValue={p.bonus || ""} placeholder="+ Bonus" className="input h-8 w-24 py-1 text-xs" />
                          <input name="deduction" type="number" min="0" step="0.01" defaultValue={p.deduction || ""} placeholder="− Deduct" className="input h-8 w-24 py-1 text-xs" />
                          <input name="note" defaultValue={p.note ?? ""} placeholder="Note" className="input h-8 w-28 py-1 text-xs" />
                          <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">Save</SubmitButton>
                        </ActionForm>
                      ) : (
                        <span className="text-xs text-slate-600">
                          {p.bonus > 0 && <span className="text-brand-green">+{money(p.bonus, cur)} </span>}
                          {p.deduction > 0 && <span className="text-brand-red">−{money(p.deduction, cur)}</span>}
                          {!p.bonus && !p.deduction && "—"}
                          {p.note && <div className="text-slate-400">{p.note}</div>}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-ink">{money(p.net, cur)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge map={PAYSLIP_STATUS} value={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/payslip/${p.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Payslip">
                          <FileText className="h-4 w-4" />
                        </Link>
                        {canEdit && (
                          <form action={setPayslipPaid}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="paid" value={p.status === "PAID" ? "0" : "1"} />
                            <button className={btn(p.status === "PAID" ? "ghost" : "success", "px-2.5 py-1 text-xs")}>{p.status === "PAID" ? "Undo" : "Mark paid"}</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {noSalary.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-amber-700">
            No salary set for:{" "}
            {noSalary.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/admin/hr/employees/${s.id}`} className="underline">{s.firstName} {s.lastName}</Link>
              </span>
            ))}
            . They are left out of payroll.
          </p>
        )}
      </Card>
    </div>
  );
}
