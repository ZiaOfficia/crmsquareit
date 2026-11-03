import type { Task, Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { inputDate } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

export async function TaskForm({
  action,
  task,
  defaults,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  task?: Task & { assignees: Staff[] };
  defaults?: { projectId?: number; assigneeId?: number };
}) {
  const [projects, customers, staff] = await Promise.all([
    db.project.findMany({ where: { status: { notIn: ["CANCELLED", "FINISHED"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.customer.findMany({ where: { active: true }, orderBy: { company: "asc" }, select: { id: true, company: true } }),
    db.staff.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
  ]);
  const t = task;
  const assigned = new Set(t ? t.assignees.map((a) => a.id) : defaults?.assigneeId ? [defaults.assigneeId] : []);
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Task name *" className="sm:col-span-2"><input name="name" required defaultValue={t?.name} className="input" /></Field>
          <Field label="Project">
            <select name="projectId" defaultValue={t?.projectId ?? defaults?.projectId ?? ""} className="input">
              <option value="">— No project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Customer" hint="Auto-filled from the project if left empty">
            <select name="customerId" defaultValue={t?.customerId ?? ""} className="input">
              <option value="">—</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={t?.priority ?? "MEDIUM"} className="input">
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={t?.status ?? "NOT_STARTED"} className="input">
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input name="startDate" type="date" defaultValue={inputDate(t?.startDate ?? new Date())} className="input" /></Field>
          <Field label="Due date"><input name="dueDate" type="date" defaultValue={inputDate(t?.dueDate)} className="input" /></Field>
          <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={5} defaultValue={t?.description ?? ""} className="input" /></Field>
          <div className="sm:col-span-2">
            <span className="label">Assignees</span>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-blue-50">
                  <input type="checkbox" name="assignees" value={s.id} defaultChecked={assigned.has(s.id)} /> {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billable" defaultChecked={t?.billable} /> Billable</label>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>{t ? "Save task" : "Create task"}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
