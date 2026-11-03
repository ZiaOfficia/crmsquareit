import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "../../form";
import { saveProject } from "../../actions";

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("projects", "edit");
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id: Number(id) }, include: { members: true } });
  if (!p) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Edit ${p.name}`} back={{ href: `/admin/projects/${p.id}`, label: p.name }} />
      <ProjectForm action={saveProject.bind(null, p.id)} project={p} />
    </div>
  );
}
