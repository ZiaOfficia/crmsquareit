import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Avatar, Badge, ButtonLink, Card, PageHeader, Table } from "@/components/ui";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const user = await requirePerm("staff");
  const staff = await db.staff.findMany({ orderBy: [{ active: "desc" }, { firstName: "asc" }], include: { role: true, _count: { select: { tasks: { where: { status: { not: "COMPLETE" } } } } } } });
  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${staff.filter((s) => s.active).length} active members`}
        actions={<>{user.isAdmin && <ButtonLink variant="secondary" href="/admin/staff/roles">Roles & permissions</ButtonLink>}<ButtonLink href="/admin/staff/new">+ Add staff</ButtonLink></>}
      />
      <Card>
        <Table head={["Name", "Email", "Role", "Open tasks", "Last login", "Status"]}>
          {staff.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60">
              <td className="td">
                <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-3 font-medium text-slate-800 hover:text-primary">
                  <Avatar name={`${s.firstName} ${s.lastName}`} size={30} /> {s.firstName} {s.lastName}
                </Link>
              </td>
              <td className="td">{s.email}</td>
              <td className="td">{s.isAdmin ? <Badge tone="purple">Administrator</Badge> : s.role?.name ?? "—"}</td>
              <td className="td">{s._count.tasks}</td>
              <td className="td text-slate-500">{s.lastLogin ? fmtDateTime(s.lastLogin) : "Never"}</td>
              <td className="td">{s.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
