import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MODULES, parsePermissions } from "@/lib/permissions";
import { ButtonLink, Card, PageHeader, Table } from "@/components/ui";

export const metadata = { title: "Roles" };
export default async function RolesPage() {
  await requireAdmin();
  const roles = await db.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { staff: true } } } });
  return (
    <>
      <PageHeader title="Roles & permissions" subtitle="Administrators always have full access" back={{ href: "/admin/staff", label: "Staff" }} actions={<ButtonLink href="/admin/staff/roles/new">+ New role</ButtonLink>} />
      <Card>
        <Table head={["Role", "Staff", "Modules"]}>
          {roles.map((r) => {
            const p = parsePermissions(r.permissions);
            return (
              <tr key={r.id}>
                <td className="td"><Link className="link" href={`/admin/staff/roles/${r.id}`}>{r.name}</Link></td>
                <td className="td">{r._count.staff}</td>
                <td className="td text-xs text-slate-500">{MODULES.filter((m) => p[m.key]?.length).map((m) => m.label).join(", ") || "No access"}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
