import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "../form";
import { saveProject } from "../actions";

export const metadata = { title: "New project" };
export default async function NewProject({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await requirePerm("projects", "create");
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader title="New project" back={{ href: "/admin/projects", label: "Projects" }} />
      <ProjectForm action={saveProject.bind(null, null)} defaultCustomerId={sp.customerId ? Number(sp.customerId) : undefined} />
    </div>
  );
}
