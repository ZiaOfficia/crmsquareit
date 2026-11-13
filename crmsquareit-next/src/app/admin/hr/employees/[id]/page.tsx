import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { money } from "@/lib/format";
import { Avatar, Card, Field, PageHeader, StatusBadge, ButtonLink } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/client";
import { ATTENDANCE_STATUS, LEAVE_TYPES, PAYSLIP_STATUS, dayKey, daysOfMonth, dbDate, dbKey, monthLabel, monthOf } from "@/lib/hr";
import { hrConfig, leaveBalances } from "@/lib/hr-server";
import { saveEmployee } from "../../actions";
import { LeaveRow } from "../../parts";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const { id } = await params;
  const e = await db.staff.findUnique({ where: { id: Number(id) }, include: { orgMemberships: { include: { department: true } }, role: true } });
  if (!e) notFound();
  const today = dayKey();
  const month = monthOf(today);
  const days = daysOfMonth(month);
  const cfg = await hrConfig();
  const [att, leaves, slips, balances] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], where: { staffId: e.id, date: { gte: dbDate(days[0]), lte: dbDate(days[days.length - 1]) } }, _count: true }),
    db.leaveRequest.findMany({ where: { staffId: e.id }, orderBy: { fromDate: "desc" }, take: 8, include: { reviewedBy: { select: { firstName: true } } } }),
    db.payslip.findMany({ where: { staffId: e.id }, orderBy: { month: "desc" }, take: 6 }),
    leaveBalances([e.id], Number(today.slice(0, 4)), cfg.quota),
  ]);
  const d = (v: Date | null) => (v ? dbKey(v) : "");
  const field = (name: string, label: string, value: string | number | null | undefined, type = "text", extra?: object) => (
    <Field label={label}>
      <input name={name} type={type} defaultValue={value ?? ""} className="input" disabled={!canEdit} {...extra} />
    </Field>
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={`${e.firstName} ${e.lastName}`} size={40} />
            {e.firstName} {e.lastName}
          </span>
        }
        subtitle={[e.designation, e.orgMemberships.map((m) => m.department.name).join(", "), e.email].filter(Boolean).join(" · ")}
        back={{ href: "/admin/hr/employees", label: "Employees" }}
        actions={can(user, "staff", "edit") ? <ButtonLink variant="secondary" href={`/admin/staff/${e.id}`}>Login & role</ButtonLink> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="HR record" className="xl:col-span-2">
          <ActionForm action={saveEmployee.bind(null, e.id)} savedText="Saved." className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {field("employeeCode", "Employee code", e.employeeCode, "text", { placeholder: "e.g. SQ-014" })}
              {field("designation", "Designation", e.designation, "text", { placeholder: "e.g. SEO Executive" })}
              {field("joinDate", "Date of joining", d(e.joinDate), "date")}
              {field("dob", "Date of birth", d(e.dob), "date")}
              <Field label="Gender">
                <select name="gender" defaultValue={e.gender ?? ""} className="input" disabled={!canEdit}>
                  <option value="">—</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </Field>
              {field("phone", "Phone", e.phone)}
            </div>
            {field("address", "Address", e.address)}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("emergencyName", "Emergency contact", e.emergencyName)}
              {field("emergencyPhone", "Emergency phone", e.emergencyPhone)}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Salary &amp; bank</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {field("monthlySalary", `Monthly salary (${cfg.currency})`, e.monthlySalary || "", "number", { min: 0, step: "0.01" })}
                {field("pan", "PAN", e.pan)}
                {field("bankName", "Bank", e.bankName)}
                {field("bankAccount", "Account number", e.bankAccount)}
                {field("bankIfsc", "IFSC", e.bankIfsc)}
              </div>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <SubmitButton>Save HR record</SubmitButton>
              </div>
            )}
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card title={`Attendance · ${monthLabel(month)}`} actions={<Link href={`/admin/hr/attendance?month=${month}&staffId=${e.id}`} className="link text-xs">Register</Link>}>
            <div className="grid grid-cols-5 gap-2 p-4">
              {Object.entries(ATTENDANCE_STATUS).map(([k, s]) => (
                <div key={k} className={`rounded-lg p-2 text-center ${s.cell}`}>
                  <p className="text-lg font-bold">{att.find((a) => a.status === k)?._count ?? 0}</p>
                  <p className="text-[10px] font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title={`Leave balance · ${today.slice(0, 4)}`}>
            <ul className="divide-y divide-slate-100">
              {Object.entries(LEAVE_TYPES).map(([k, t]) => {
                const b = balances[e.id][k];
                return (
                  <li key={k} className="flex justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-medium">
                      {Number.isFinite(b.left) ? (
                        <>
                          {b.left} <span className="text-slate-400">/ {b.quota} left</span>
                        </>
                      ) : (
                        <>{b.used} taken</>
                      )}
                      {b.pending > 0 && <span className="ml-1 text-xs text-amber-600">({b.pending} pending)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Payslips" actions={<Link href="/admin/hr/payroll" className="link text-xs">Payroll</Link>}>
            {slips.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No payslips yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {slips.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
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
        </div>
      </div>
      <Card title="Leave history" className="mt-6">
        {leaves.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No leave taken.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {leaves.map((l) => (
              <LeaveRow key={l.id} l={l} review={canEdit} cancel={canEdit} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
