import Link from "next/link";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { money } from "@/lib/format";
import { Avatar, Badge, Card, Table } from "@/components/ui";
import { SearchBox } from "@/components/client";
import { dbKey, fmtDay } from "@/lib/hr";
import { hrConfig } from "@/lib/hr-server";

export const metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  await requirePerm("hr");
  const { q, inactive } = await searchParams;
  const cfg = await hrConfig();
  const staff = await db.staff.findMany({
    where: {
      active: inactive !== "1",
      ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }, { designation: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { firstName: "asc" },
    include: { orgMemberships: { include: { department: true }, take: 1 } },
  });
  const missing = staff.filter((s) => !s.joinDate || !s.monthlySalary || !s.designation).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <SearchBox placeholder="Search name, code, designation…" />
        <Link href={inactive === "1" ? "?" : "?inactive=1"} className="text-xs font-medium text-slate-500 hover:text-primary">
          {inactive === "1" ? "Show active" : "Show former staff"}
        </Link>
        {missing > 0 && <span className="ml-auto text-xs text-amber-700">{missing} record(s) missing designation, joining date or salary</span>}
      </div>
      <Table head={["Employee", "Code", "Designation", "Department", "Joined", "Phone", "Monthly salary", ""]}>
        {staff.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50/60">
            <td className="td">
              <Link href={`/admin/hr/employees/${s.id}`} className="flex items-center gap-3 font-medium text-slate-800 hover:text-primary">
                <Avatar name={`${s.firstName} ${s.lastName}`} size={30} />
                <span>
                  {s.firstName} {s.lastName}
                  <span className="block text-xs font-normal text-slate-500">{s.email}</span>
                </span>
              </Link>
            </td>
            <td className="td text-sm">{s.employeeCode ?? "—"}</td>
            <td className="td text-sm">{s.designation ?? <span className="text-slate-400">—</span>}</td>
            <td className="td text-sm">{s.orgMemberships[0]?.department.name ?? "—"}</td>
            <td className="td whitespace-nowrap text-sm">{s.joinDate ? fmtDay(dbKey(s.joinDate)) : <span className="text-slate-400">—</span>}</td>
            <td className="td text-sm">{s.phone ?? "—"}</td>
            <td className="td whitespace-nowrap text-sm font-medium tabular-nums">{s.monthlySalary ? money(s.monthlySalary, cfg.currency) : <Badge tone="amber">Not set</Badge>}</td>
            <td className="td text-right">
              <Link href={`/admin/hr/employees/${s.id}`} className="link text-xs">Open</Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
