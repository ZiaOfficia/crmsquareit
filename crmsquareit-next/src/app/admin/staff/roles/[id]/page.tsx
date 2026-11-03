import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { RoleForm } from "../role-form";
import { deleteRole, saveRole } from "../../actions";

export default async function EditRole({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const role = await db.role.findUnique({ where: { id: Number(id) } });
  if (!role) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={role.name} back={{ href: "/admin/staff/roles", label: "Roles" }} actions={<ConfirmButton action={deleteRole} hidden={{ id: role.id }} />} />
      <RoleForm action={saveRole.bind(null, role.id)} role={role} />
    </div>
  );
}
