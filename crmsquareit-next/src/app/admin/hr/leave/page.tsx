import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Card, EmptyState, Table } from "@/components/ui";
import { LEAVE_STATUS, LEAVE_TYPES, dayKey } from "@/lib/hr";
import { hrConfig, leaveBalances } from "@/lib/hr-server";
import { LeaveForm, LeaveRow } from "../parts";

export const metadata = { title: "Leave" };

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePerm("hr");
  const canEdit = can(user, "hr", "edit");
  const { status = "PENDING" } = await searchParams;
  const filter = status in LEAVE_STATUS ? status : "ALL";
  const year = Number(dayKey().slice(0, 4));
  const cfg = await hrConfig();
  const [requests, counts, staff] = await Promise.all([
    db.leaveRequest.findMany({
      where: filter === "ALL" ? {} : { status: filter },
      orderBy: filter === "PENDING" ? { fromDate: "asc" } : { fromDate: "desc" },
      take: 100,
      include: { staff: { select: { firstName: true, lastName: true, designation: true } }, reviewedBy: { select: { firstName: true } } },
    }),
    db.leaveRequest.groupBy({ by: ["status"], _count: true }),
    db.staff.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const balances = await leaveBalances(staff.map((s) => s.id), year, cfg.quota);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const paidTypes = Object.keys(LEAVE_TYPES).filter((t) => t !== "UNPAID");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
            {[...Object.keys(LEAVE_STATUS), "ALL"].map((s) => (
              <Link
                key={s}
                href={`?status=${s}`}
                className={clsx("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", filter === s ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800")}
              >
                {s === "ALL" ? "All" : LEAVE_STATUS[s].label}
                {s !== "ALL" && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{n(s)}</span>}
              </Link>
            ))}
          </div>
          {requests.length === 0 ? (
            <EmptyState title={filter === "PENDING" ? "No leave waiting for approval" : "No leave requests"} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((l) => (
                <LeaveRow key={l.id} l={l} review={canEdit} cancel={canEdit} />
              ))}
            </ul>
          )}
        </Card>
        {can(user, "hr", "create") && (
          <Card title="Add leave for someone">
            <LeaveForm staff={staff.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))} />
          </Card>
        )}
      </div>

      <Card title={`Leave balances · ${year}`} actions={<Link href="/admin/hr/settings" className="link text-xs">Change allowances</Link>}>
        <Table head={["Employee", ...paidTypes.map((t) => LEAVE_TYPES[t].label), "Unpaid taken"]}>
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="td font-medium">
                <Link href={`/admin/hr/employees/${s.id}`} className="hover:text-primary">{s.firstName} {s.lastName}</Link>
              </td>
              {paidTypes.map((t) => {
                const b = balances[s.id][t];
                return (
                  <td key={t} className="td text-sm">
                    <span className={clsx("font-semibold", b.left === 0 ? "text-brand-red" : "text-ink")}>{b.left}</span>
                    <span className="text-slate-400"> / {b.quota} left</span>
                    {b.pending > 0 && <span className="ml-1 text-xs text-amber-600">({b.pending} pending)</span>}
                  </td>
                );
              })}
              <td className="td text-sm">{balances[s.id].UNPAID.used || "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
