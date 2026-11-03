import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "../../form";
import { saveTask } from "../../actions";

export default async function EditTask({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("tasks", "edit");
  const { id } = await params;
  const t = await db.task.findUnique({ where: { id: Number(id) }, include: { assignees: true } });
  if (!t) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Edit task`} back={{ href: `/admin/tasks/${t.id}`, label: t.name }} />
      <TaskForm action={saveTask.bind(null, t.id)} task={t} />
    </div>
  );
}
