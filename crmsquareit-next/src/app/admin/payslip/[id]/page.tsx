import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { fmtDate, money } from "@/lib/format";
import { PrintButton } from "@/components/client";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PAYSLIP_STATUS, dbKey, fmtDay, monthLabel } from "@/lib/hr";

export const metadata = { title: "Payslip" };

/** Printable payslip. HR sees everyone's; staff see their own once it's paid. */
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.payslip.findUnique({
    where: { id: Number(id) },
    include: { staff: { include: { orgMemberships: { include: { department: true }, take: 1 } } } },
  });
  if (!p) notFound();
  const isHr = can(user, "hr");
  if (!isHr && (p.staffId !== user.id || p.status !== "PAID")) redirect("/admin/forbidden");
  const s = await getSettings();
  const cur = s.currency;
  const e = p.staff;
  const rows: [string, string | null | undefined][] = [
    ["Employee", `${e.firstName} ${e.lastName}`],
    ["Employee code", e.employeeCode],
    ["Designation", e.designation],
    ["Department", e.orgMemberships[0]?.department.name],
    ["Date of joining", e.joinDate ? fmtDay(dbKey(e.joinDate)) : null],
    ["PAN", e.pan],
    ["Bank", [e.bankName, e.bankAccount && `A/c ${e.bankAccount}`, e.bankIfsc].filter(Boolean).join(" · ")],
  ];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Payslip · ${monthLabel(p.month)}`}
          back={isHr ? { href: `/admin/hr/payroll?month=${p.month}`, label: "Payroll" } : { href: "/admin/my", label: "My HR" }}
          actions={
            <>
              <StatusBadge map={PAYSLIP_STATUS} value={p.status} />
              <PrintButton />
            </>
          }
        />
      </div>
      <div className="card mx-auto max-w-3xl p-8 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="mb-2 h-10" />
            <p className="font-semibold text-ink">{s.company_legal_name || s.company_name}</p>
            <p className="text-xs text-slate-500">{[s.company_address, s.company_city, s.company_state].filter(Boolean).join(", ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Salary slip</p>
            <p className="text-lg font-bold text-ink">{monthLabel(p.month)}</p>
            {p.paidAt && <p className="text-xs text-slate-500">Paid on {fmtDate(p.paidAt)}</p>}
          </div>
        </div>

        <dl className="grid gap-x-8 gap-y-2 py-5 text-sm sm:grid-cols-2">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-800">{v}</dd>
              </div>
            ))}
        </dl>

        <div className="grid gap-6 sm:grid-cols-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Earnings</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2">Monthly salary</td>
                <td className="py-2 text-right tabular-nums">{money(p.salary, cur)}</td>
              </tr>
              {p.bonus > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2">Bonus / incentive</td>
                  <td className="py-2 text-right tabular-nums">{money(p.bonus, cur)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Deductions</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2">
                  Loss of pay <span className="text-xs text-slate-500">({p.lopDays} of {p.workingDays} days)</span>
                </td>
                <td className="py-2 text-right tabular-nums">{money(p.lopAmount, cur)}</td>
              </tr>
              {p.deduction > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2">Other deductions</td>
                  <td className="py-2 text-right tabular-nums">{money(p.deduction, cur)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net pay</p>
            <p className="text-xs text-slate-500">
              Working days {p.workingDays} · Paid days {p.workingDays - p.lopDays}
            </p>
          </div>
          <p className="text-2xl font-bold text-ink">{money(p.net, cur)}</p>
        </div>
        {p.note && <p className="mt-4 text-sm text-slate-600">Note: {p.note}</p>}
        <p className="mt-8 text-center text-[11px] text-slate-400">This is a computer-generated payslip and does not need a signature.</p>
      </div>
    </>
  );
}
