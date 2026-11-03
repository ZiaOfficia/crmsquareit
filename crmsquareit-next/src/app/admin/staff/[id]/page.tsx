import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/client";
import { StaffForm } from "../form";
import { deleteStaff, saveStaff } from "../actions";

export default async function EditStaff({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("staff", "edit");
  const { id } = await params;
  const s = await db.staff.findUnique({ where: { id: Number(id) } });
  if (!s) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${s.firstName} ${s.lastName}`}
        back={{ href: "/admin/staff", label: "Staff" }}
        actions={can(user, "staff", "delete") && s.id !== user.id && s.active && <ConfirmButton action={deleteStaff} hidden={{ id: s.id }} label="Deactivate" />}
      />
      <StaffForm action={saveStaff.bind(null, s.id)} staff={s} canSetAdmin={user.isAdmin} />
    </div>
  );
}
