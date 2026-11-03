import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "../../form";
import { updateLead } from "../../actions";

export default async function EditLead({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("leads", "edit");
  const { id } = await params;
  const [lead, statuses, sources, staff] = await Promise.all([
    db.lead.findUnique({ where: { id: Number(id) } }),
    db.leadStatus.findMany({ orderBy: { order: "asc" } }),
    db.leadSource.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  if (!lead) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${lead.name}`} back={{ href: `/admin/leads/${lead.id}`, label: lead.name }} />
      <LeadForm action={updateLead.bind(null, lead.id)} lead={lead} statuses={statuses} sources={sources} staff={staff} currentUserId={user.id} />
    </div>
  );
}
