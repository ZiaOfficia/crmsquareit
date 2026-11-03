import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "../form";
import { saveTask } from "../actions";

export const metadata = { title: "New task" };
export default async function NewTask({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const user = await requirePerm("tasks", "create");
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader title="New task" back={{ href: "/admin/tasks", label: "Tasks" }} />
      <TaskForm action={saveTask.bind(null, null)} defaults={{ projectId: sp.projectId ? Number(sp.projectId) : undefined, assigneeId: user.id }} />
    </div>
  );
}
