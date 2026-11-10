import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { canManageOrg, teamRoleLabel } from "@/lib/org";
import { Avatar, Badge, ButtonLink, Card, PageHeader, Table } from "@/components/ui";
import { redirect } from "next/navigation";
import { DepartmentsView } from "./departments-view";

export const metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePerm("staff");
  if ((await searchParams).view === "departments") {
    if (!canManageOrg(user)) redirect("/admin/forbidden"); // Super Admin and HR
    return <DepartmentsView viewer={{ id: user.id, isAdmin: user.isAdmin }} />;
  }
  const staff = await db.staff.findMany({ orderBy: [{ active: "desc" }, { firstName: "asc" }], include: { role: true, orgMemberships: { include: { department: { include: { parent: true } } } }, _count: { select: { tasks: { where: { status: { not: "COMPLETE" } } } } } } });
  // Open "forgot password" requests, shown to Super Admin and HR so they can help.
  const resetIds = canManageOrg(user)
    ? new Set((await db.passwordReset.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } }, select: { staffId: true } })).map((r) => r.staffId))
    : new Set<number>();
  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${staff.filter((s) => s.active).length} active members`}
        actions={<>{canManageOrg(user) && <ButtonLink variant="secondary" href="/admin/staff?view=departments">Departments</ButtonLink>}{user.isAdmin && <ButtonLink variant="secondary" href="/admin/staff/roles">Roles & permissions</ButtonLink>}{can(user, "staff", "create") && <ButtonLink href="/admin/staff/new">+ Add staff</ButtonLink>}</>}
      />
      <Card>
        <Table head={["Name", "Email", "Department", "Role", "Open tasks", "Last login", "Status"]}>
          {staff.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="td">
                <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-3 font-medium text-slate-800 hover:text-primary">
                  <Avatar name={`${s.firstName} ${s.lastName}`} size={30} /> {s.firstName} {s.lastName}
                </Link>
              </td>
              <td className="td">{s.email}</td>
              <td className="td text-sm">
                {s.orgMemberships.length
                  ? s.orgMemberships.map((m) => (
                      <span key={m.id} className="block whitespace-nowrap">
                        {m.department.parent ? `${m.department.parent.name} › ` : ""}{m.department.name} <Badge tone={m.teamRole === "TL" ? "blue" : "gray"}>{teamRoleLabel(m.teamRole)}</Badge>
                      </span>
                    ))
                  : <span className="text-slate-400">—</span>}
              </td>
              <td className="td">{s.isAdmin ? <Badge tone="purple">Super Admin</Badge> : s.role?.name ?? "—"}</td>
              <td className="td">{s._count.tasks}</td>
              <td className="td text-slate-500">{s.lastLogin ? fmtDateTime(s.lastLogin) : "Never"}</td>
              <td className="td">{s.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>} {resetIds.has(s.id) && <Badge tone="amber">Reset requested</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
