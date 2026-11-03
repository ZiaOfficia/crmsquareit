import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StaffForm } from "../form";
import { saveStaff } from "../actions";

export const metadata = { title: "Add staff" };
export default async function NewStaff() {
  const user = await requirePerm("staff", "create");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add staff member" back={{ href: "/admin/staff", label: "Staff" }} />
      <StaffForm action={saveStaff.bind(null, null)} canSetAdmin={user.isAdmin} />
    </div>
  );
}
