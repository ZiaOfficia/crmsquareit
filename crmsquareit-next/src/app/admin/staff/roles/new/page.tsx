import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RoleForm } from "../role-form";
import { saveRole } from "../../actions";

export default async function NewRole() {
  await requireAdmin();
  return (
    <div className="max-w-4xl">
      <PageHeader title="New role" back={{ href: "/admin/staff/roles", label: "Roles" }} />
      <RoleForm action={saveRole.bind(null, null)} />
    </div>
  );
}
