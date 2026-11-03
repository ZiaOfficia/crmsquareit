import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "../form";
import { createLead } from "../actions";

export const metadata = { title: "New lead" };

export default async function NewLead() {
  const user = await requirePerm("leads", "create");
  const [statuses, sources, staff] = await Promise.all([
    db.leadStatus.findMany({ orderBy: { order: "asc" } }),
    db.leadSource.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New lead" back={{ href: "/admin/leads", label: "Leads" }} />
      <LeadForm action={createLead} statuses={statuses} sources={sources} staff={staff} currentUserId={user.id} />
    </div>
  );
}
